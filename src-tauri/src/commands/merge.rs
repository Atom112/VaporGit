use crate::git;
use crate::git_err;

#[tauri::command]
pub async fn merge_branch(
    path: String,
    branch_name: String,
    strategy: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::merge::merge_branch(&repo, &branch_name, &strategy)
    })
    .await
    .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}
