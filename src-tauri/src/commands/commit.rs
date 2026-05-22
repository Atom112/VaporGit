use crate::git;
use crate::models::commit::{CommitDetail, CommitGraphData, CommitInfo};

#[tauri::command]
pub async fn commit(path: String, message: String) -> Result<CommitInfo, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::commit(&repo, &message)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_commit_history(
    path: String,
    page: u32,
    page_size: u32,
) -> Result<Vec<CommitInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::get_commit_history(&repo, page, page_size)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_commit_detail(path: String, commit_id: String) -> Result<CommitDetail, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::get_commit_detail(&repo, &commit_id)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_commit_graph(path: String) -> Result<CommitGraphData, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::get_commit_graph(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn rebase(path: String, onto: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::rebase(&repo, &onto)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn cherry_pick(path: String, commit_id: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::cherry_pick(&repo, &commit_id)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn undo(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::undo(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn redo(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::redo(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
