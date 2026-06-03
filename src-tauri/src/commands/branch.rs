use crate::git;
use crate::models::branch::{BranchDiffSummary, BranchInfo};

#[tauri::command]
pub async fn get_branch_list(path: String) -> Result<Vec<BranchInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::get_branch_list(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn create_branch(path: String, name: String, from: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::create_branch(&repo, &name, from.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn checkout_branch(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::checkout_branch(&repo, &name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn checkout_remote_branch(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::checkout_remote_branch(&repo, &name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn delete_branch(path: String, name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::delete_branch(&repo, &name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn delete_remote_branch(path: String, remote_name: String, branch_name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::delete_remote_branch(&repo, &remote_name, &branch_name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn compare_branches(
    path: String,
    base_branch: String,
    target_branch: String,
) -> Result<BranchDiffSummary, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::branch::compare_branches(&repo, &base_branch, &target_branch)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
