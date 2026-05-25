use git2::{Repository, StatusOptions, StatusShow};
use crate::models::status::{FileStatus, StatusKind};
use crate::models::conflict::ConflictEntry;

pub fn get_status(repo: &Repository) -> Result<Vec<FileStatus>, String> {
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("无法获取状态: {}", e))?;

    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        let (kind, staged, old_path) = if status.is_index_new() {
            (StatusKind::IndexNew, true, None)
        } else if status.is_index_modified() {
            (StatusKind::IndexModified, true, None)
        } else if status.is_index_deleted() {
            (StatusKind::IndexDeleted, true, None)
        } else if status.is_index_renamed() {
            let old = entry
                .head_to_index()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().to_string());
            (StatusKind::Renamed, true, old)
        } else if status.is_wt_new() {
            (StatusKind::WtNew, false, None)
        } else if status.is_wt_modified() {
            (StatusKind::WtModified, false, None)
        } else if status.is_wt_deleted() {
            (StatusKind::WtDeleted, false, None)
        } else if status.is_wt_renamed() {
            let old = entry
                .index_to_workdir()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().to_string());
            (StatusKind::Renamed, false, old)
        } else if status.is_conflicted() {
            (StatusKind::Conflicted, false, None)
        } else {
            continue;
        };

        result.push(FileStatus {
            path,
            status: kind,
            staged,
            old_path,
        });
    }

    Ok(result)
}

pub fn stage_files(repo: &Repository, files: &[String]) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let workdir = repo.workdir().ok_or("没有工作目录")?;

    for file in files {
        let path = std::path::Path::new(file);
        // Skip directories — git only stages files
        let full = workdir.join(path);
        if full.is_dir() {
            continue;
        }
        index
            .add_path(path)
            .map_err(|e| format!("暂存失败 {}: {}", file, e))?;
    }

    index.write().map_err(|e| format!("写入索引失败: {}", e))?;
    Ok(())
}

pub fn unstage_files(repo: &Repository, files: &[String]) -> Result<(), String> {
    let head = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_tree = head
        .peel_to_tree()
        .map_err(|e| format!("无法获取 HEAD 树: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;

    for file in files {
        let path = std::path::Path::new(file);
        if let Ok(entry) = head_tree.get_path(path) {
            let idx_entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: entry.filemode() as u32,
                uid: 0,
                gid: 0,
                file_size: 0,
                id: entry.id(),
                flags: 0,
                flags_extended: 0,
                path: file.as_bytes().to_vec(),
            };
            index
                .add(&idx_entry)
                .map_err(|e| format!("取消暂存失败 {}: {}", file, e))?;
        } else {
            index
                .remove_path(path)
                .map_err(|e| format!("取消暂存失败 {}: {}", file, e))?;
        }
    }

    index.write().map_err(|e| format!("写入索引失败: {}", e))?;
    Ok(())
}

pub fn get_conflicts(repo: &Repository) -> Result<Vec<ConflictEntry>, String> {
    let index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;

    if !index.has_conflicts() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    let conflicts = index.conflicts()
        .map_err(|e| format!("无法获取冲突迭代器: {}", e))?;
    for conflict_result in conflicts {
        let conflict = match conflict_result {
            Ok(c) => c,
            Err(e) => return Err(format!("无法读取冲突: {}", e)),
        };
        let file_path = conflict
            .ancestor
            .as_ref()
            .or_else(|| conflict.our.as_ref())
            .or_else(|| conflict.their.as_ref())
            .map(|e| std::str::from_utf8(&e.path).unwrap_or("").to_string())
            .unwrap_or_default();

        result.push(ConflictEntry {
            file_path,
            ancestor_mode: conflict.ancestor.as_ref().map(|e| e.mode),
            ours_mode: conflict.our.as_ref().map(|e| e.mode),
            theirs_mode: conflict.their.as_ref().map(|e| e.mode),
        });
    }

    Ok(result)
}

pub fn resolve_conflict(repo: &Repository, file: &str, resolution: &str) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let path = std::path::Path::new(file);

    // Find the conflict entry BEFORE removing it
    let (entry_id, entry_mode) = {
        let stage = match resolution {
            "ours" => 2,
            "theirs" => 3,
            _ => return Err("无效的解决策略，请使用 'ours' 或 'theirs'".to_string()),
        };

        let conflicts = index.conflicts()
            .map_err(|e| format!("无法获取冲突迭代器: {}", e))?;
        let mut found = None;
        for conflict_result in conflicts {
            let conflict = match conflict_result {
                Ok(c) => c,
                Err(_) => continue,
            };
            let conflict_path = conflict
                .ancestor
                .as_ref()
                .or_else(|| conflict.our.as_ref())
                .or_else(|| conflict.their.as_ref())
                .map(|e| std::str::from_utf8(&e.path).unwrap_or(""))
                .unwrap_or("")
                .to_string();

            if conflict_path != file {
                continue;
            }

            let entry = match stage {
                2 => conflict.our,
                3 => conflict.their,
                _ => None,
            };

            if let Some(e) = entry {
                found = Some((e.id, e.mode));
            }
            break;
        }
        found.ok_or_else(|| format!("无法找到文件 '{}' 的冲突条目", file))?
    };

    // Remove the conflicted entry from index
    index
        .remove_path(path)
        .map_err(|e| format!("无法移除冲突条目: {}", e))?;

    // Add the resolved entry
    let idx_entry = git2::IndexEntry {
        ctime: git2::IndexTime::new(0, 0),
        mtime: git2::IndexTime::new(0, 0),
        dev: 0,
        ino: 0,
        mode: entry_mode,
        uid: 0,
        gid: 0,
        file_size: 0,
        id: entry_id,
        flags: 0,
        flags_extended: 0,
        path: file.as_bytes().to_vec(),
    };
    index
        .add(&idx_entry)
        .map_err(|e| format!("无法添加解决后的条目: {}", e))?;

    index
        .write()
        .map_err(|e| format!("写入索引失败: {}", e))?;
    Ok(())
}
