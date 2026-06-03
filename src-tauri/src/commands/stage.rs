use crate::git;

#[tauri::command]
pub async fn stage_hunk(path: String, file_path: String, hunk_index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::stage::stage_hunk(&repo, &file_path, hunk_index)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stage_line(path: String, file_path: String, hunk_index: usize, line_index: usize) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::stage::stage_line(&repo, &file_path, hunk_index, line_index)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
