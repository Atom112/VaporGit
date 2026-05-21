use git2::Repository;
use std::path::Path;
use crate::models::repo::RepoInfo;

pub fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| format!("无法打开仓库: {}", e))
}

fn extract_repo_name(url: &str) -> Option<String> {
    url.trim_end_matches(".git")
        .trim_end_matches('/')
        .split('/')
        .last()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

pub fn clone_repo(url: &str, path: &str) -> Result<(Repository, RepoInfo), String> {
    let target_path = Path::new(path);

    // If the target exists and is not empty, derive a repo name from the URL
    // and clone into a new subdirectory instead of failing.
    let actual_path = if target_path.exists() {
        let is_empty = target_path
            .read_dir()
            .map(|mut d| d.next().is_none())
            .unwrap_or(false);
        if is_empty {
            path.to_string()
        } else {
            let repo_name =
                extract_repo_name(url).ok_or_else(|| "无法从 URL 解析仓库名称".to_string())?;
            let new_path = target_path.join(&repo_name);
            if new_path.exists() {
                let new_is_empty = new_path
                    .read_dir()
                    .map(|mut d| d.next().is_none())
                    .unwrap_or(false);
                if !new_is_empty {
                    return Err(format!(
                        "目标目录 '{}' 已存在且不为空",
                        new_path.display()
                    ));
                }
            }
            new_path.to_string_lossy().to_string()
        }
    } else {
        path.to_string()
    };

    let repo = Repository::clone(url, &actual_path)
        .map_err(|e| format!("克隆仓库失败: {}", e))?;
    let info = get_repo_info(&repo, &actual_path)?;
    Ok((repo, info))
}

pub fn get_repo_info(repo: &Repository, path: &str) -> Result<RepoInfo, String> {
    let head = repo.head().ok();
    let head_branch = head
        .as_ref()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));
    let head_commit = head
        .as_ref()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());
    let is_detached = head.as_ref().map(|h| h.is_remote()).unwrap_or(false)
        || repo.head_detached().unwrap_or(false);

    let state_summary = if repo.state() != git2::RepositoryState::Clean {
        format!("{:?}", repo.state())
    } else {
        "Clean".to_string()
    };

    let is_bare = repo.is_bare();

    Ok(RepoInfo {
        path: path.to_string(),
        head_branch,
        head_commit,
        is_bare,
        is_detached,
        state_summary,
    })
}