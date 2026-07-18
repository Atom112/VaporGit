use std::{io::Read, path::Path};
use git2::{DiffOptions, Repository, Oid};
use crate::git_err;
use crate::models::diff::{DiffHunk, DiffLine, DiffLineKind, DiffResult};
use base64::Engine;

const MAX_DIFF_SIZE: usize = 1_000_000;
const FULL_FILE_LIMIT: usize = 128 * 1024;
const FULL_FILE_HARD_LIMIT: usize = 256 * 1024;
const FULL_FILE_TOO_LARGE_MESSAGE: &str = "当前文件体积过大，无法完整读取";

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
        .map_err(|e| git_err!("DIFF_FAILED", "Failed to generate diff: {}", e))?;

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
    .map_err(|e| git_err!("DIFF_PARSE_FAILED", "Failed to parse diff: {}", e))?;

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
            let oid = Oid::from_str(id).map_err(|e| git_err!("DIFF_INVALID_COMMIT_ID", "Invalid commit ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| git_err!("DIFF_COMMIT_NOT_FOUND", "Commit not found: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| git_err!("DIFF_TREE_FAILED", "Failed to get tree: {}", e))?;
            let entry = tree
                .get_path(Path::new(file_path))
                .map_err(|e| git_err!("DIFF_FILE_NOT_FOUND_IN_COMMIT", "File not found in commit: {}", e))?;
            let blob = entry
                .to_object(repo)
                .map_err(|e| git_err!("DIFF_OBJECT_FAILED", "Failed to get file object: {}", e))?
                .peel_to_blob()
                .map_err(|e| git_err!("DIFF_READ_CONTENT_FAILED", "Failed to read file content: {}", e))?;
            let content = blob.content();
            if content.len() > FULL_FILE_HARD_LIMIT {
                return Ok(FULL_FILE_TOO_LARGE_MESSAGE.to_string());
            }
            Ok(format_full_file_content(content, content.len()))
        }
        None => {
            let workdir = repo
                .workdir()
                .ok_or_else(|| git_err!("DIFF_NO_WORKDIR", "Failed to get working directory"))?;
            let full_path = workdir.join(file_path);
            let metadata = std::fs::metadata(&full_path)
                .map_err(|e| git_err!("DIFF_METADATA_FAILED", "Failed to read file metadata: {}", e))?;
            let total_len = metadata.len() as usize;
            if total_len > FULL_FILE_HARD_LIMIT {
                return Ok(FULL_FILE_TOO_LARGE_MESSAGE.to_string());
            }
            let mut file = std::fs::File::open(&full_path)
                .map_err(|e| git_err!("DIFF_READ_FAILED", "Failed to read file: {}", e))?;
            let mut buf = Vec::new();
            file.by_ref()
                .take(FULL_FILE_LIMIT as u64)
                .read_to_end(&mut buf)
                .map_err(|e| git_err!("DIFF_READ_FAILED", "Failed to read file: {}", e))?;
            Ok(format_full_file_content(&buf, total_len))
        }
    }
}

fn format_full_file_content(content: &[u8], total_len: usize) -> String {
    let mut text = String::from_utf8_lossy(&content[..content.len().min(FULL_FILE_LIMIT)]).to_string();
    if total_len > FULL_FILE_LIMIT {
        text.push_str("\n\n--- 当前文件超过 128KB，仅显示前 128KB 内容 ---");
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_file_content_truncates_after_limit() {
        let content = vec![b'a'; FULL_FILE_LIMIT + 8];
        let rendered = format_full_file_content(&content, content.len());

        assert!(rendered.starts_with(&"a".repeat(FULL_FILE_LIMIT)));
        assert!(rendered.contains("仅显示前 128KB 内容"));
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
            let oid = Oid::from_str(id).map_err(|e| git_err!("DIFF_INVALID_COMMIT_ID", "Invalid commit ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| git_err!("DIFF_COMMIT_NOT_FOUND", "Commit not found: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| git_err!("DIFF_TREE_FAILED", "Failed to get tree: {}", e))?;
            let entry = tree
                .get_path(Path::new(file_path))
                .map_err(|e| git_err!("DIFF_FILE_NOT_FOUND_IN_COMMIT", "File not found in commit: {}", e))?;
            let blob = entry
                .to_object(repo)
                .map_err(|e| git_err!("DIFF_OBJECT_FAILED", "Failed to get file object: {}", e))?
                .peel_to_blob()
                .map_err(|e| git_err!("DIFF_READ_CONTENT_FAILED", "Failed to read file content: {}", e))?;
            blob.content().to_vec()
        }
        None => {
            let workdir = repo
                .workdir()
                .ok_or_else(|| git_err!("DIFF_NO_WORKDIR", "Failed to get working directory"))?;
            let full_path = workdir.join(file_path);
            if !full_path.exists() {
                return Ok(None);
            }
            std::fs::read(&full_path).map_err(|e| git_err!("DIFF_READ_FAILED", "Failed to read file: {}", e))?
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
    let workdir = repo.workdir().ok_or_else(|| git_err!("DIFF_NO_WORKDIR", "Failed to get working directory"))?;
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
                git2::Oid::from_str(id).map_err(|e| git_err!("DIFF_INVALID_COMMIT_ID", "Invalid commit ID: {}", e))?;
            let commit = repo
                .find_commit(oid)
                .map_err(|e| git_err!("DIFF_COMMIT_NOT_FOUND", "Commit not found: {}", e))?;
            let tree = commit
                .tree()
                .map_err(|e| git_err!("DIFF_TREE_FAILED", "Failed to get tree: {}", e))?;
            Ok(Some(tree))
        }
        None => Ok(None),
    }
}
