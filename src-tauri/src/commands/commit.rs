use crate::git;
use crate::models::commit::{CommitDetail, CommitGraphData, CommitInfo, RebaseEntry};

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
pub async fn amend_commit(path: String, message: String) -> Result<CommitInfo, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::amend_commit(&repo, &message)
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
pub async fn list_rebase_commits(path: String, onto_branch: String) -> Result<Vec<RebaseEntry>, String> {
    tokio::task::spawn_blocking(move || -> Result<Vec<RebaseEntry>, String> {
        let repo = git::repo::open_repo(&path)?;
        git::commit::list_rebase_commits(&repo, &onto_branch)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn perform_interactive_rebase(
    path: String,
    onto_branch: String,
    entries: Vec<RebaseEntry>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::perform_interactive_rebase(&repo, &onto_branch, &entries)
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

#[tauri::command]
pub async fn search_commit_history(
    path: String,
    query: String,
    page: u32,
    page_size: u32,
) -> Result<Vec<CommitInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::search_commit_history(&repo, &query, page, page_size)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn revert_commit(path: String, commit_id: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::commit::revert_commit(&repo, &commit_id)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
