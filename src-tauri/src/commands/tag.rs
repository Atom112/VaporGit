use crate::git;
use crate::git_err;

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
    .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}
