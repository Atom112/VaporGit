use crate::git;
use crate::models::stash::StashInfo;

#[tauri::command]
pub async fn stash_save(path: String, message: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = git::repo::open_repo(&path)?;
        git::stash::stash_save(&mut repo, message.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stash_list(path: String) -> Result<Vec<StashInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = git::repo::open_repo(&path)?;
        git::stash::stash_list(&mut repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stash_pop(path: String, index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = git::repo::open_repo(&path)?;
        git::stash::stash_pop(&mut repo, index)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stash_apply(path: String, index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = git::repo::open_repo(&path)?;
        git::stash::stash_apply(&mut repo, index)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stash_drop(path: String, index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mut repo = git::repo::open_repo(&path)?;
        git::stash::stash_drop(&mut repo, index)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
