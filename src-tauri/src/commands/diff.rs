use crate::git;
use crate::models::diff::DiffResult;

#[tauri::command]
pub fn get_file_diff(
    path: String,
    file_path: String,
    old_commit: Option<String>,
    new_commit: Option<String>,
) -> Result<DiffResult, String> {
    let repo = git::repo::open_repo(&path)?;
    git::diff::get_file_diff(
        &repo,
        &file_path,
        old_commit.as_deref(),
        new_commit.as_deref(),
    )
}

#[tauri::command]
pub fn get_file_content(
    path: String,
    file_path: String,
    commit_id: Option<String>,
) -> Result<String, String> {
    let repo = git::repo::open_repo(&path)?;
    git::diff::get_file_content(&repo, &file_path, commit_id.as_deref())
}