use crate::git;
use crate::models::remote::RemoteInfo;

#[tauri::command]
pub async fn get_remotes(path: String) -> Result<Vec<RemoteInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::get_remotes(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn fetch(path: String, remote: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::fetch(&repo, remote.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn pull(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::pull(&repo, remote.as_deref(), branch.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::push(&repo, remote.as_deref(), branch.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
