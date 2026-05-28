use crate::gitee::api::GiteeClient;
use crate::models::gitee::{
    GiteeAuthStatus, GiteeBranch, GiteeCreatePullRequest, GiteeMergePullRequest,
    GiteeMergePullResult, GiteePRComment, GiteePullRequest, GiteePullRequestFile, GiteeRepo,
    GiteeUser,
};

fn authenticated_client() -> Result<GiteeClient, String> {
    let token = crate::gitee::auth::token_store()
        .load()?
        .ok_or("not_authenticated")?;
    GiteeClient::new(token)
}

#[tauri::command]
pub async fn gitee_login(app: tauri::AppHandle) -> Result<GiteeUser, String> {
    crate::gitee::auth::start_auth(app).await
}

#[tauri::command]
pub async fn gitee_check_auth() -> Result<GiteeAuthStatus, String> {
    crate::gitee::auth::check_auth().await
}

#[tauri::command]
pub async fn gitee_logout() -> Result<(), String> {
    crate::gitee::auth::clear_token()
}

#[tauri::command]
pub async fn gitee_get_user() -> Result<GiteeUser, String> {
    let client = authenticated_client()?;
    client.get_current_user().await
}

#[tauri::command]
pub async fn gitee_list_repos(page: Option<u32>, per_page: Option<u32>) -> Result<Vec<GiteeRepo>, String> {
    let client = authenticated_client()?;
    client.list_user_repos(page.unwrap_or(1), per_page.unwrap_or(50)).await
}

#[tauri::command]
pub async fn gitee_get_repo(owner: String, repo: String) -> Result<GiteeRepo, String> {
    let client = authenticated_client()?;
    client.get_repo(&owner, &repo).await
}

#[tauri::command]
pub async fn gitee_create_repo(
    name: String,
    description: Option<String>,
    private: bool,
) -> Result<GiteeRepo, String> {
    let client = authenticated_client()?;
    client.create_repo(&name, description.as_deref(), private).await
}

#[tauri::command]
pub async fn gitee_list_branches(owner: String, repo: String) -> Result<Vec<GiteeBranch>, String> {
    let client = authenticated_client()?;
    client.list_branches(&owner, &repo).await
}

#[tauri::command]
pub async fn gitee_list_pulls(
    owner: String,
    repo: String,
    state: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Vec<GiteePullRequest>, String> {
    let client = authenticated_client()?;
    client
        .list_pulls(&owner, &repo, state.as_deref(), page.unwrap_or(1), per_page.unwrap_or(30))
        .await
}

#[tauri::command]
pub async fn gitee_get_pull(
    owner: String,
    repo: String,
    number: u32,
) -> Result<GiteePullRequest, String> {
    let client = authenticated_client()?;
    client.get_pull(&owner, &repo, number).await
}

#[tauri::command]
pub async fn gitee_create_pull(
    owner: String,
    repo: String,
    request: GiteeCreatePullRequest,
) -> Result<GiteePullRequest, String> {
    let client = authenticated_client()?;
    client.create_pull(&owner, &repo, &request).await
}

#[tauri::command]
pub async fn gitee_merge_pull(
    owner: String,
    repo: String,
    number: u32,
    request: GiteeMergePullRequest,
) -> Result<GiteeMergePullResult, String> {
    let client = authenticated_client()?;
    client.merge_pull(&owner, &repo, number, &request).await
}

#[tauri::command]
pub async fn gitee_get_pull_files(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<GiteePullRequestFile>, String> {
    let client = authenticated_client()?;
    client.get_pull_files(&owner, &repo, number).await
}

#[tauri::command]
pub async fn gitee_get_pull_diff(
    owner: String,
    repo: String,
    number: u32,
) -> Result<String, String> {
    let client = authenticated_client()?;
    client.get_pull_diff(&owner, &repo, number).await
}

#[tauri::command]
pub async fn gitee_list_pull_comments(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<GiteePRComment>, String> {
    let client = authenticated_client()?;
    client.list_pull_comments(&owner, &repo, number).await
}
