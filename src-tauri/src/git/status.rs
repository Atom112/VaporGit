use std::path::{Path, PathBuf};
use git2::{Repository, StatusOptions, StatusShow};
use crate::models::status::{FileStatus, StatusKind};
use crate::models::conflict::ConflictEntry;

/// Read working-tree + index status using git2's `Diff` API for rename
/// detection — the same approach GitKraken uses (content-based similarity
/// instead of basename heuristics).
///
/// 1. Collect raw status entries (no rename flags).
/// 2. Diff HEAD→Index + find_similar(renames) for staged renames.
/// 3. Diff Index→Workdir + find_similar(renames) for unstaged renames.
/// 4. Merge the rename deltas into the status list.
pub fn get_status(repo: &Repository) -> Result<Vec<FileStatus>, String> {
    let mut opts = StatusOptions::new();
    opts.show(StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true);
    // No rename flags — Diff API handles it below.

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

        result.push(FileStatus { path, status: kind, staged, old_path: None });
    }

    // ── Staged renames: Diff HEAD tree → Index ──
    if let Ok(head) = repo.head() {
        if let Ok(head_tree) = head.peel_to_tree() {
            if let Ok(mut diff) =
                repo.diff_tree_to_index(Some(&head_tree), None, None)
            {
                let mut find_opts = git2::DiffFindOptions::new();
                find_opts.renames(true);
                let _ = diff.find_similar(Some(&mut find_opts));
                merge_renames_from_diff(&mut result, &diff, true);
            }
        }
    }

    // ── Unstaged renames: Diff Index → Workdir ──
    if let Ok(mut diff) = repo.diff_index_to_workdir(None, None) {
        let mut find_opts = git2::DiffFindOptions::new();
        find_opts.renames(true);
        let _ = diff.find_similar(Some(&mut find_opts));
        merge_renames_from_diff(&mut result, &diff, false);
    }

    Ok(result)
}

/// For each rename delta in `diff`, remove the matching delete + add entries
/// from `statuses` and replace them with a single `RENAMED` entry.
fn merge_renames_from_diff(
    statuses: &mut Vec<FileStatus>,
    diff: &git2::Diff<'_>,
    staged: bool,
) {
    let (del_kind, add_kind) = if staged {
        (StatusKind::IndexDeleted, StatusKind::IndexNew)
    } else {
        (StatusKind::WtDeleted, StatusKind::WtNew)
    };

    for delta in diff.deltas() {
        if delta.status() != git2::Delta::Renamed {
            continue;
        }

        let old_path = match delta.old_file().path() {
            Some(p) => p.to_string_lossy().into_owned(),
            None => continue,
        };
        let new_path = match delta.new_file().path() {
            Some(p) => p.to_string_lossy().into_owned(),
            None => continue,
        };

        // Find the matching delete + add entries
        let del_idx = statuses.iter().position(|f| {
            f.path == old_path && f.status == del_kind && f.staged == staged
        });
        let add_idx = statuses.iter().position(|f| {
            f.path == new_path && f.status == add_kind && f.staged == staged
        });

        if let (Some(di), Some(ai)) = (del_idx, add_idx) {
            // Remove higher index first
            let (hi, li) = (di.max(ai), di.min(ai));
            statuses.remove(hi);
            statuses.remove(li);
            statuses.push(FileStatus {
                path: new_path,
                status: StatusKind::Renamed,
                staged,
                old_path: Some(old_path),
            });
        }
        // else: one side already consumed by an earlier rename delta,
        // or the entry is conflicted — leave raw entries as-is.
    }
}

pub fn stage_files(repo: &Repository, files: &[String]) -> Result<Vec<FileStatus>, String> {
    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "无法获取工作目录".to_string())?;

    // Validate all paths first
    for file in files {
        validate_path_in_workdir(workdir, file)?;
    }

    // First pass: remove all files that no longer exist on disk.
    // Doing this BEFORE add_path helps git2 detect renames in the
    // second pass (the index sees old paths cleared first).
    for file in files {
        let path = std::path::Path::new(file);
        let abs_path = workdir.join(path);
        if !abs_path.exists() {
            index
                .remove_path(path)
                .map_err(|e| format!("取消跟踪 {} 失败: {}", file, e))?;
        }
    }

    // Second pass: add all files that exist on disk.
    for file in files {
        let path = std::path::Path::new(file);
        let abs_path = workdir.join(path);
        if abs_path.exists() {
            index
                .add_path(path)
                .map_err(|e| format!("暂存 {} 失败: {}", file, e))?;
        }
    }

    index.write().map_err(|e| format!("写入索引失败: {}", e))?;

    // Re-read the index from disk to ensure any internal libgit2 caches
    // are refreshed before computing status on the same repo.
    index.read(true).map_err(|e| format!("重读索引失败: {}", e))?;

    // Return fresh status read from the same repo — this guarantees
    // the status reflects the just-written index without any cross-call
    // timing issues.
    get_status(repo)
}

pub fn unstage_files(repo: &Repository, files: &[String]) -> Result<Vec<FileStatus>, String> {
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

    // Re-read the index from disk (see stage_files for rationale).
    index.read(true).map_err(|e| format!("重读索引失败: {}", e))?;

    // Return fresh status from the same repo.
    get_status(repo)
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

pub fn get_conflict_content(repo: &Repository, file: &str, stage: &str) -> Result<String, String> {
    // "worktree" reads from the working tree file (contains conflict markers)
    if stage == "worktree" {
        let workdir = repo
            .workdir()
            .ok_or_else(|| "无法获取工作目录".to_string())?;
        let abs_path = workdir.join(file);
        return std::fs::read_to_string(&abs_path)
            .map_err(|e| format!("无法读取工作目录文件 '{}': {}", file, e));
    }

    let index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;

    let conflicts = index.conflicts()
        .map_err(|e| format!("无法获取冲突迭代器: {}", e))?;

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
            "ours" => conflict.our,
            "theirs" => conflict.their,
            "ancestor" => conflict.ancestor,
            _ => return Err("无效的阶段参数，请使用 'ours'、'theirs' 或 'ancestor'".to_string()),
        };

        if let Some(e) = entry {
            let blob = repo.find_blob(e.id).map_err(|_| format!("无法读取文件 '{}' 的内容", file))?;
            if blob.is_binary() {
                return Ok("[二进制文件]".to_string());
            }
            let content = std::str::from_utf8(blob.content())
                .map_err(|_| "文件内容不是有效的 UTF-8 文本".to_string())?;
            return Ok(content.to_string());
        }
    }

    Ok(String::new())
}

/// Validate that a path is within the repository workdir.
/// Returns the canonicalized absolute path if valid, or an error.
fn validate_path_in_workdir(workdir: &Path, file: &str) -> Result<PathBuf, String> {
    let path = Path::new(file);
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(format!("路径 '{}' 包含 '..'，不允许操作", file));
    }
    if path.is_absolute() {
        return Err(format!("路径 '{}' 是绝对路径，请使用相对路径", file));
    }
    let abs_path = workdir.join(path);
    // Normalize to canonical if it exists, otherwise check prefix
    let canonical = abs_path.canonicalize().unwrap_or_else(|_| abs_path.clone());
    let workdir_canonical = workdir.canonicalize().map_err(|e| format!("无法规范化工作目录: {}", e))?;
    if !canonical.starts_with(&workdir_canonical) {
        return Err(format!("路径 '{}' 在仓库工作目录之外", file));
    }
    Ok(canonical)
}

pub fn discard_files(repo: &Repository, files: &[String]) -> Result<Vec<FileStatus>, String> {
    let workdir = repo.workdir().ok_or_else(|| "无法获取工作目录".to_string())?;
    let workdir_canonical = workdir.canonicalize().map_err(|e| format!("无法规范化工作目录: {}", e))?;
    let head = repo.head().ok();
    let head_tree = head.as_ref().and_then(|h| h.peel_to_tree().ok());

    let mut tracked = Vec::new();
    let mut untracked = Vec::new();

    for file in files {
        // Validate path is within workdir
        let _validated_path = validate_path_in_workdir(workdir, file)?;

        let path = std::path::Path::new(file);

        // Check for directory: refuse recursive deletion — user should discard individual files
        let abs_path = workdir_canonical.join(path);
        if abs_path.is_dir() {
            return Err(format!("路径 '{}' 是目录，不支持递归丢弃。请单独选择文件操作。", file));
        }

        if head_tree.as_ref().map_or(false, |tree| tree.get_path(path).is_ok()) {
            tracked.push(file.clone());
        } else {
            untracked.push(file.clone());
        }
    }

    // Checkout tracked files from HEAD (restores working tree + index)
    if !tracked.is_empty() {
        let mut checkout = git2::build::CheckoutBuilder::new();
        checkout.force().update_index(true);
        for f in &tracked {
            checkout.path(std::path::Path::new(f.as_str()));
        }
        repo.checkout_head(Some(&mut checkout))
            .map_err(|e| format!("无法撤销文件更改: {}", e))?;
    }

    // Delete untracked/new files from disk and remove from index
    if !untracked.is_empty() {
        for file in &untracked {
            let path = std::path::Path::new(file);
            let abs_path = workdir_canonical.join(path);
            // Double-check: validated earlier, but guard against TOCTOU
            if !abs_path.starts_with(&workdir_canonical) {
                continue;
            }
            if abs_path.exists() {
                // Only delete files, not directories (directories were rejected above,
                // but check again for safety in case a directory was created between validation and now)
                if abs_path.is_dir() {
                    return Err(format!("目录 '{}' 不会自动删除，请手动清理", file));
                }
                std::fs::remove_file(&abs_path)
                    .map_err(|e| format!("无法删除文件 '{}': {}", file, e))?;
            }
        }
        let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
        for file in &untracked {
            index.remove_path(std::path::Path::new(file)).ok();
        }
        index.write().map_err(|e| format!("写入索引失败: {}", e))?;
        index.read(true).map_err(|e| format!("重读索引失败: {}", e))?;
    }

    get_status(repo)
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

    // Write the resolved blob content to the working tree file
    let blob = repo
        .find_blob(entry_id)
        .map_err(|e| format!("无法读取已解决的文件内容: {}", e))?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "无法获取工作目录".to_string())?;
    let abs_path = workdir.join(path);
    std::fs::write(&abs_path, blob.content())
        .map_err(|e| format!("无法写入已解决的文件 '{}': {}", file, e))?;

    index
        .write()
        .map_err(|e| format!("写入索引失败: {}", e))?;
    Ok(())
}
