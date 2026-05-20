use git2::{DiffOptions, Repository};
use crate::models::diff::{DiffHunk, DiffLine, DiffLineKind, DiffResult};

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
                    old_start: hunk.old_start() as u32,
                    old_lines: hunk.old_lines() as u32,
                    new_start: hunk.new_start() as u32,
                    new_lines: hunk.new_lines() as u32,
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