use git2::{Repository, StatusOptions, StatusShow};
use crate::models::status::{FileStatus, StatusKind};

pub fn get_status(repo: &Repository) -> Result<Vec<FileStatus>, String> {
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("无法获取状态: {}", e))?;

    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        let (kind, staged) = if status.is_index_new() {
            (StatusKind::IndexNew, true)
        } else if status.is_index_modified() {
            (StatusKind::IndexModified, true)
        } else if status.is_index_deleted() {
            (StatusKind::IndexDeleted, true)
        } else if status.is_wt_new() {
            (StatusKind::WtNew, false)
        } else if status.is_wt_modified() {
            (StatusKind::WtModified, false)
        } else if status.is_wt_deleted() {
            (StatusKind::WtDeleted, false)
        } else if status.is_conflicted() {
            (StatusKind::Conflicted, false)
        } else {
            continue;
        };

        result.push(FileStatus {
            path,
            status: kind,
            staged,
        });
    }

    Ok(result)
}

pub fn stage_files(repo: &Repository, files: &[String]) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;

    for file in files {
        index
            .add_path(std::path::Path::new(file))
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