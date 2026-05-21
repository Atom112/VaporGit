use git2::Repository;
use crate::models::repo::RepoInfo;

pub fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| format!("无法打开仓库: {}", e))
}

pub fn clone_repo(url: &str, path: &str) -> Result<(Repository, RepoInfo), String> {
    let repo = Repository::clone(url, path)
        .map_err(|e| format!("克隆仓库失败: {}", e))?;
    let info = get_repo_info(&repo, path)?;
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