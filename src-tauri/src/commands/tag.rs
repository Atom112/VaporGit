use crate::git;
use crate::models::git_ext::TagInfo;

#[tauri::command]
pub async fn create_tag(
    path: String,
    commit_id: String,
    tag_name: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::tag::create_tag(&repo, &commit_id, &tag_name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn list_tags(path: String) -> Result<Vec<TagInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::tag::list_tags(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn delete_tag(path: String, tag_name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::tag::delete_tag(&repo, &tag_name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}
