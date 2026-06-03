use crate::git;

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
    .map_err(|e| format!("内部错误: {}", e))?
}
