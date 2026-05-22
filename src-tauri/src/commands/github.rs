use crate::github::{api::GitHubClient, auth, parse_github_response, update};
use crate::models::github::{
    AuthStatus, CreatePullRequest, GitHubBranch, GitHubPullRequest, GitHubRelease,
    GitHubReleaseAsset, GitHubRepo, GitHubUser, MergePullRequest, MergePullResult, PullRequestFile,
    PRComment,
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

/// List branches for a repository.
#[tauri::command]
pub async fn github_list_branches(owner: String, repo: String) -> Result<Vec<GitHubBranch>, String> {
    let client = authenticated_client()?;
    client.list_branches(&owner, &repo).await
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

/// Compare two semver strings (e.g. "1.0.4" vs "1.0.5").
/// Returns true if `latest` is strictly greater than `current`.
fn is_newer_version(latest: &str, current: &str) -> bool {
    let latest_parts: Vec<u32> = latest
        .split('.')
        .filter_map(|s| s.parse::<u32>().ok())
        .collect();
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse::<u32>().ok())
        .collect();

    let max_len = latest_parts.len().max(current_parts.len());
    for i in 0..max_len {
        let l = latest_parts.get(i).copied().unwrap_or(0);
        let c = current_parts.get(i).copied().unwrap_or(0);
        if l > c {
            return true;
        } else if l < c {
            return false;
        }
    }
    false
}

/// Check if a newer version of VaporGit is available on GitHub.
/// Uses the public GitHub Releases API (no authentication required).
#[tauri::command]
pub async fn check_update() -> Result<Option<GitHubRelease>, String> {
    let current_version = env!("CARGO_PKG_VERSION");

    let client = reqwest::Client::builder()
        .user_agent("VaporGit/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let resp = client
        .get("https://api.github.com/repos/Atom112/VaporGit/releases/latest")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    // Silently return None on any HTTP error (no network, rate-limited, etc.)
    if !resp.status().is_success() {
        return Ok(None);
    }

    let release: GitHubRelease = parse_github_response(resp).await?;

    let latest_tag = release.tag_name.trim_start_matches('v');
    if is_newer_version(latest_tag, current_version) {
        Ok(Some(release))
    } else {
        Ok(None)
    }
}

/// Find the asset matching the current platform from a release.
#[tauri::command]
pub async fn github_get_asset(release: GitHubRelease) -> Result<Option<GitHubReleaseAsset>, String> {
    Ok(update::find_matching_asset(&release.assets))
}

/// Download the update asset with progress events.
#[tauri::command]
pub async fn github_start_download(
    app: tauri::AppHandle,
    asset: GitHubReleaseAsset,
) -> Result<String, String> {
    update::download_update(&app, &asset).await
}

/// Launch the installer and exit the app.
#[tauri::command]
pub async fn github_install_update(
    app: tauri::AppHandle,
    installer_path: String,
) -> Result<(), String> {
    update::install_update(&installer_path, &app)
}
