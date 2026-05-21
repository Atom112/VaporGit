use crate::github::{api::GitHubClient, auth};
use crate::models::github::{
    AuthStatus, CreatePullRequest, GitHubPullRequest, GitHubRepo, GitHubUser, MergePullRequest,
    MergePullResult, PullRequestFile, PRComment,
};

/// Load token and create an authenticated GitHub client.
fn authenticated_client() -> Result<GitHubClient, String> {
    let token = auth::load_token()?.ok_or("not_authenticated")?;
    GitHubClient::new(token)
}

/// Start the GitHub OAuth Authorization Code Flow (PKCE) via an in-app WebView.
/// Opens a Tauri WebView to GitHub's authorization page, intercepts the callback,
/// exchanges the code for a token, and returns the authenticated user.
#[tauri::command]
pub async fn github_login(app: tauri::AppHandle) -> Result<GitHubUser, String> {
    auth::start_auth_code_flow(app).await
}

/// Check current authentication status.
#[tauri::command]
pub async fn github_check_auth() -> Result<AuthStatus, String> {
    auth::check_auth().await
}

/// Log out: clear the stored token from keychain.
#[tauri::command]
pub async fn github_logout() -> Result<(), String> {
    auth::clear_token()
}

/// Get the authenticated user's profile.
#[tauri::command]
pub async fn github_get_user() -> Result<GitHubUser, String> {
    let client = authenticated_client()?;
    client.get_current_user().await
}

/// List repositories for the authenticated user.
#[tauri::command]
pub async fn github_list_repos(page: Option<u32>, per_page: Option<u32>) -> Result<Vec<GitHubRepo>, String> {
    let client = authenticated_client()?;
    client.list_user_repos(page.unwrap_or(1), per_page.unwrap_or(100)).await
}

/// Get a single repository by owner and name.
#[tauri::command]
pub async fn github_get_repo(owner: String, repo: String) -> Result<GitHubRepo, String> {
    let client = authenticated_client()?;
    client.get_repo(&owner, &repo).await
}

/// List pull requests for a repository.
#[tauri::command]
pub async fn github_list_pulls(
    owner: String,
    repo: String,
    state: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Vec<GitHubPullRequest>, String> {
    let client = authenticated_client()?;
    client
        .list_pulls(&owner, &repo, state.as_deref(), page.unwrap_or(1), per_page.unwrap_or(30))
        .await
}

/// Get a single pull request by number.
#[tauri::command]
pub async fn github_get_pull(owner: String, repo: String, number: u32) -> Result<GitHubPullRequest, String> {
    let client = authenticated_client()?;
    client.get_pull(&owner, &repo, number).await
}

/// Create a pull request.
#[tauri::command]
pub async fn github_create_pull(
    owner: String,
    repo: String,
    request: CreatePullRequest,
) -> Result<GitHubPullRequest, String> {
    let client = authenticated_client()?;
    client.create_pull(&owner, &repo, &request).await
}

/// Merge a pull request.
#[tauri::command]
pub async fn github_merge_pull(
    owner: String,
    repo: String,
    number: u32,
    request: MergePullRequest,
) -> Result<MergePullResult, String> {
    let client = authenticated_client()?;
    client.merge_pull(&owner, &repo, number, &request).await
}

/// Get the list of changed files in a pull request.
#[tauri::command]
pub async fn github_get_pull_files(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<PullRequestFile>, String> {
    let client = authenticated_client()?;
    client.get_pull_files(&owner, &repo, number).await
}

/// Get the raw diff for a pull request.
#[tauri::command]
pub async fn github_get_pull_diff(owner: String, repo: String, number: u32) -> Result<String, String> {
    let client = authenticated_client()?;
    client.get_pull_diff(&owner, &repo, number).await
}

/// List comments on a pull request.
#[tauri::command]
pub async fn github_list_pull_comments(
    owner: String,
    repo: String,
    number: u32,
) -> Result<Vec<PRComment>, String> {
    let client = authenticated_client()?;
    client.list_pull_comments(&owner, &repo, number).await
}

/// Create a review comment on a pull request.
#[tauri::command]
pub async fn github_create_pull_comment(
    owner: String,
    repo: String,
    number: u32,
    body: String,
    commit_id: String,
    path: String,
    position: u32,
) -> Result<PRComment, String> {
    let client = authenticated_client()?;
    client
        .create_pull_comment(&owner, &repo, number, &body, &commit_id, &path, position)
        .await
}
