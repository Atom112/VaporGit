use crate::git;
use crate::models::git_ext::{BlameLine, LfsOperationResult, ReflogEntry, SshConnectionResult};

#[tauri::command]
pub async fn submodule_add(path: String, url: String, submodule_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::submodule_add(&repo, &url, &submodule_path)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn submodule_init(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::submodule_init(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn submodule_update(path: String, recursive: bool) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::submodule_update(&repo, recursive)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn git_blame(path: String, file_path: String) -> Result<Vec<BlameLine>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::git_blame(&repo, &file_path)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_reflog(path: String, reference: Option<String>) -> Result<Vec<ReflogEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::get_reflog(&repo, reference.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn lfs_pull(path: String) -> Result<LfsOperationResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::lfs_pull(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn lfs_track(path: String, pattern: String) -> Result<LfsOperationResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::lfs_track(&repo, &pattern)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn lfs_untrack(path: String, pattern: String) -> Result<LfsOperationResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::git_ext::lfs_untrack(&repo, &pattern)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn test_ssh_connection(host: String, key_path: Option<String>) -> Result<SshConnectionResult, String> {
    tokio::task::spawn_blocking(move || {
        git::git_ext::test_ssh_connection(&host, key_path.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
