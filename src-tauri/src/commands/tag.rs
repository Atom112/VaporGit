use crate::git;

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
