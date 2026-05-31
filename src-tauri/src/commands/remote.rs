use crate::git;
use crate::models::remote::RemoteInfo;
use crate::remote_url;

#[tauri::command]
pub async fn get_remotes(path: String) -> Result<Vec<RemoteInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::get_remotes(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn fetch(path: String, remote: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::fetch(&repo, remote.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn pull(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::pull(&repo, remote.as_deref(), branch.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::push(&repo, remote.as_deref(), branch.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

/// Push, auto-creating the remote repository if it doesn't exist.
///
/// Returns "pushed" on normal success, "auto_created_and_pushed" when the
/// remote was auto-created before pushing, or an error message.
#[tauri::command]
pub async fn push_with_auto_create(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    let remote_name = remote.as_deref().unwrap_or("origin").to_string();

    // Step 1: Get remote URL (auto-configure if we can identify the platform)
    let remote_url = match get_remote_url_for_push(&path, &remote_name).await {
        Ok(url) => url,
        Err(e) if remote_url::is_remote_not_found_error(&e) => {
            auto_configure_remote(&path, &remote_name).await?
        }
        Err(e) => return Err(e),
    };

    // Step 2: If we can identify the platform and repo, ensure the remote repo exists
    if let Ok(parsed) = remote_url::parse_remote_url(&remote_url) {
        ensure_remote_repo(&parsed).await?;
    }

    // Step 3: Push
    try_push(&path, &remote, &branch).await?;

    Ok("pushed".to_string())
}

/// Check if a remote repository exists; create it if it doesn't.
async fn ensure_remote_repo(parsed: &remote_url::ParsedRemoteUrl) -> Result<(), String> {
    let exists = repo_exists_on_platform(parsed).await;

    match exists {
        Some(true) => Ok(()),                          // already exists, nothing to do
        Some(false) => {
            // Doesn't exist — create it
            create_remote_repo(parsed).await
        }
        None => Ok(()),                                // can't determine, skip
    }
}

/// Returns Some(true) if the repo exists, Some(false) if not, None if undetermined.
async fn repo_exists_on_platform(parsed: &remote_url::ParsedRemoteUrl) -> Option<bool> {
    match parsed.platform {
        remote_url::Platform::GitHub => {
            let token = crate::github::auth::load_token().ok().flatten()?;
            let client = crate::github::api::GitHubClient::new(token).ok()?;
            match client.get_repo(&parsed.owner, &parsed.repo_name).await {
                Ok(_) => Some(true),
                Err(e) if e.contains("404") || e.to_lowercase().contains("not found") => Some(false),
                Err(_) => None,
            }
        }
        remote_url::Platform::Gitee => {
            let raw = crate::gitee::auth::token_store().load().ok().flatten()?;
            let client = crate::gitee::api::GiteeClient::new(raw).ok()?;
            match client.get_repo(&parsed.owner, &parsed.repo_name).await {
                Ok(_) => Some(true),
                Err(e) if e.contains("404") || e.to_lowercase().contains("not found") => Some(false),
                Err(_) => None,
            }
        }
    }
}

async fn get_remote_url_for_push(path: &str, remote_name: &str) -> Result<String, String> {
    let path = path.to_string();
    let name = remote_name.to_string();
    let r = tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::get_push_url(&repo, &name)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?;
    r.map_err(|e| e)
}

/// Auto-configure a remote based on the logged-in platform (GitHub or Gitee).
/// Uses the local repo's folder name as the repository name.
async fn auto_configure_remote(path: &str, remote_name: &str) -> Result<String, String> {
    let repo_name = {
        let path = path.to_string();
        let r: Result<String, String> = tokio::task::spawn_blocking(move || {
            let repo = git::repo::open_repo(&path).map_err(|e| e.to_string())?;
            let workdir = repo
                .workdir()
                .ok_or_else(|| "无法获取仓库工作目录".to_string())?;
            let name = workdir
                .file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.to_string())
                .ok_or_else(|| "无法从路径获取仓库名称".to_string())?;
            Ok(name)
        })
        .await
        .map_err(|e| format!("内部错误: {}", e))?;
        r?
    };

    // Try GitHub first
    if let Ok(Some(token)) = crate::github::auth::load_token() {
        let client = crate::github::api::GitHubClient::new(token)?;
        let user = client.get_current_user().await?;
        let remote_url = format!("https://github.com/{}/{}.git", user.login, repo_name);
        add_remote_to_repo(path, remote_name, &remote_url).await?;
        return Ok(remote_url);
    }

    // Then try Gitee
    if let Ok(Some(token)) = crate::gitee::auth::token_store().load() {
        let client = crate::gitee::api::GiteeClient::new(token)?;
        let user = client.get_current_user().await?;
        let remote_url = format!("https://gitee.com/{}/{}.git", user.login, repo_name);
        add_remote_to_repo(path, remote_name, &remote_url).await?;
        return Ok(remote_url);
    }

    Err("未登录 GitHub 或 Gitee，无法自动配置远程仓库。请先在设置中登录，或手动添加远程仓库。".to_string())
}

async fn add_remote_to_repo(path: &str, remote_name: &str, url: &str) -> Result<(), String> {
    let path = path.to_string();
    let name = remote_name.to_string();
    let url = url.to_string();
    let r = tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        repo.remote(&name, &url)
            .map_err(|e| format!("无法添加远程 {}: {}", name, e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?;
    r
}

async fn try_push(
    path: &str,
    remote: &Option<String>,
    branch: &Option<String>,
) -> Result<(), String> {
    let path = path.to_string();
    let remote = remote.clone();
    let branch = branch.clone();
    let r = tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::remote::push(&repo, remote.as_deref(), branch.as_deref())
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?;
    r
}

async fn create_remote_repo(parsed: &remote_url::ParsedRemoteUrl) -> Result<(), String> {
    match parsed.platform {
        remote_url::Platform::GitHub => {
            let raw = crate::github::auth::load_token()
                .map_err(|_| "无法读取 GitHub 认证信息".to_string())?;
            let token = raw.ok_or_else(|| "未登录 GitHub，请在设置中先登录".to_string())?;
            let client = crate::github::api::GitHubClient::new(token)?;
            client.create_repo(&parsed.repo_name, None, true).await?;
            Ok(())
        }
        remote_url::Platform::Gitee => {
            let raw = crate::gitee::auth::token_store()
                .load()
                .map_err(|_| "无法读取 Gitee 认证信息".to_string())?;
            let token = raw.ok_or_else(|| "未登录 Gitee，请在设置中先登录".to_string())?;
            let client = crate::gitee::api::GiteeClient::new(token)?;
            client.create_repo(&parsed.repo_name, None, true).await?;
            Ok(())
        }
    }
}
