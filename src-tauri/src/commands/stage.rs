use crate::git;
use crate::git_err;

#[tauri::command]
pub async fn stage_hunk(path: String, file_path: String, hunk_index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::stage::stage_hunk(&repo, &file_path, hunk_index)
    })
    .await
    .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}

#[tauri::command]
pub async fn stage_line(path: String, file_path: String, hunk_index: usize, line_index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::stage::stage_line(&repo, &file_path, hunk_index, line_index)
    })
    .await
    .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}
