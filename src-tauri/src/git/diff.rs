use std::path::Path;
use git2::{DiffOptions, Repository, Oid};
use crate::models::diff::{DiffHunk, DiffLine, DiffLineKind, DiffResult};
use base64::Engine;

const MAX_DIFF_SIZE: usize = 1_000_000;

pub fn get_file_diff(
    repo: &Repository,
    file_path: &str,
    old_commit: Option<&str>,
    new_commit: Option<&str>,
) -> Result<DiffResult, String> {
    if is_binary(repo, file_path) {
        return Ok(DiffResult {
            file_path: file_path.to_string(),
            old_path: None,
            hunks: vec![],
            is_binary: true,
            is_too_large: false,
        });
    }

    let tree_from = resolve_tree(repo, old_commit)?;
    let tree_to = resolve_tree(repo, new_commit)?;

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = repo
        .diff_tree_to_tree(tree_from.as_ref(), tree_to.as_ref(), Some(&mut opts))
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut total_size: usize = 0;

    diff.foreach(
        &mut |delta, _| {
            if delta.new_file().is_binary() {
                return true;
            }
            true
        },
        None,
        None,
        Some(&mut |_delta, hunk, line| {
            if total_size > MAX_DIFF_SIZE {
                return true;
            }

            let hunk = match hunk {
                Some(h) => h,
                None => return true,
            };

            let header = String::from_utf8_lossy(hunk.header()).to_string();

            if hunks.is_empty() || hunks.last().unwrap().header != header {
                hunks.push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    header: header.clone(),
                    lines: Vec::new(),
                });
            }

            let content = String::from_utf8_lossy(line.content()).to_string();
            total_size += content.len();

            let kind = match line.origin() {
                '+' => DiffLineKind::Addition,
                '-' => DiffLineKind::Deletion,
                _ => DiffLineKind::Context,
            };

            if let Some(last) = hunks.last_mut() {
                last.lines.push(DiffLine { kind, content });
            }
            true
        }),
    )
    .map_err(|e| format!("解析 diff 失败: {}", e))?;

    Ok(DiffResult {
        file_path: file_path.to_string(),
        old_path: None,
        hunks,
        is_binary: false,
        is_too_large: total_size > MAX_DIFF_SIZE,
    })
}

fn is_binary(repo: &Repository, file_path: &str) -> bool {
    repo.head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok())
        .and_then(|tree| tree.get_path(std::path::Path::new(file_path)).ok())
        .and_then(|entry| entry.to_object(repo).ok())
        .and_then(|obj| obj.into_blob().ok())
        .map(|b| b.is_binary())
        .unwrap_or(false)
}

pub fn get_file_content(
    repo: &Repository,
    file_path: &str,
    commit_id: Option<&str>,
) -> Result<String, String> {
    match commit_id {
        Some(id) => {
            let oid = Oid::from_str(id).map_err(|e| format!("无效的提交 ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("无法找到提交: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| format!("无法获取树: {}", e))?;
            let entry = tree
                .get_path(Path::new(file_path))
                .map_err(|e| format!("无法在提交中找到文件: {}", e))?;
            let blob = entry
                .to_object(repo)
                .map_err(|e| format!("无法获取文件对象: {}", e))?
                .peel_to_blob()
                .map_err(|e| format!("无法读取文件内容: {}", e))?;
            Ok(String::from_utf8_lossy(blob.content()).to_string())
        }
        None => {
            let workdir = repo
                .workdir()
                .ok_or_else(|| "无法获取工作目录".to_string())?;
            let full_path = workdir.join(file_path);
            std::fs::read_to_string(&full_path)
                .map_err(|e| format!("无法读取文件: {}", e))
        }
    }
}

/// Read a file from the working directory (or a commit) and return it as a
/// base64-encoded data URL string. Returns None if the file cannot be read.
pub fn get_file_base64(
    repo: &Repository,
    file_path: &str,
    commit_id: Option<&str>,
) -> Result<Option<String>, String> {
    let content: Vec<u8> = match commit_id {
        Some(id) => {
            let oid = Oid::from_str(id).map_err(|e| format!("无效的提交 ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("无法找到提交: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| format!("无法获取树: {}", e))?;
            let entry = tree
                .get_path(Path::new(file_path))
                .map_err(|e| format!("无法在提交中找到文件: {}", e))?;
            let blob = entry
                .to_object(repo)
                .map_err(|e| format!("无法获取文件对象: {}", e))?
                .peel_to_blob()
                .map_err(|e| format!("无法读取文件内容: {}", e))?;
            blob.content().to_vec()
        }
        None => {
            let workdir = repo
                .workdir()
                .ok_or_else(|| "无法获取工作目录".to_string())?;
            let full_path = workdir.join(file_path);
            if !full_path.exists() {
                return Ok(None);
            }
            std::fs::read(&full_path).map_err(|e| format!("无法读取文件: {}", e))?
        }
    };

    let mime = match Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&content);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}

/// Check if a file in the working directory is tracked by git-lfs by checking
/// if its content matches the LFS pointer format.
pub fn check_lfs(repo: &Repository, file_path: &str) -> Result<bool, String> {
    let workdir = repo.workdir().ok_or_else(|| "无法获取工作目录".to_string())?;
    let full_path = workdir.join(file_path);
    if !full_path.exists() {
        return Ok(false);
    }
    // LFS pointer files start with "version https://git-lfs.github.com/spec/v1"
    let content = std::fs::read_to_string(&full_path).unwrap_or_default();
    Ok(content.starts_with("version https://git-lfs.github.com/spec/"))
}

fn resolve_tree<'a>(
    repo: &'a Repository,
    commit_id: Option<&str>,
) -> Result<Option<git2::Tree<'a>>, String> {
    match commit_id {
        Some(id) => {
            let oid =
                git2::Oid::from_str(id).map_err(|e| format!("无效的提交 ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| format!("无法找到提交: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| format!("无法获取树: {}", e))?;
            Ok(Some(tree))
        }
        None => Ok(None),
    }
}
