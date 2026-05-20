use crate::git;
use crate::models::commit::{CommitDetail, CommitInfo};

#[tauri::command]
pub fn commit(path: String, message: String) -> Result<CommitInfo, String> {
    let repo = git::repo::open_repo(&path)?;
    git::commit::commit(&repo, &message)
}

#[tauri::command]
pub fn get_commit_history(
    path: String,
    page: u32,
    page_size: u32,
) -> Result<Vec<CommitInfo>, String> {
    let repo = git::repo::open_repo(&path)?;
    git::commit::get_commit_history(&repo, page, page_size)
}

#[tauri::command]
pub fn get_commit_detail(path: String, commit_id: String) -> Result<CommitDetail, String> {
    let repo = git::repo::open_repo(&path)?;
    git::commit::get_commit_detail(&repo, &commit_id)
}