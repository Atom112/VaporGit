use crate::git;
use crate::models::diff::DiffResult;

#[tauri::command]
pub async fn get_file_diff(
    path: String,
    file_path: String,
    old_commit: Option<String>,
    new_commit: Option<String>,
) -> Result<DiffResult, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::diff::get_file_diff(
            &repo,
            &file_path,
            old_commit.as_deref(),
            new_commit.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_file_content(
    path: String,
    file_path: String,
    commit_id: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::diff::get_file_content(&repo, &file_path, commit_id.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_file_base64(
    path: String,
    file_path: String,
    commit_id: Option<String>,
) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::diff::get_file_base64(&repo, &file_path, commit_id.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn check_lfs(path: String, file_path: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::diff::check_lfs(&repo, &file_path)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
