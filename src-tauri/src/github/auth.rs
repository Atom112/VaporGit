use crate::github::parse_github_response;
use crate::models::github::{AuthStatus, GitHubUser};
use crate::oauth::flow::{start_auth_code_flow as start_oauth_flow, ProviderConfig};
use crate::oauth::token::{TokenConfig, TokenStore};
use keyring::Entry;
use reqwest::Client;
use std::fs;
use std::path::PathBuf;

/// Register a GitHub OAuth App at https://github.com/settings/developers
/// and set VAPORGIT_GITHUB_CLIENT_ID / VAPORGIT_GITHUB_CLIENT_SECRET env vars to override.
///
/// The built-in client ID/secret use PKCE (Proof Key for Code Exchange),
/// which is secure even without a client secret. For custom deployments,
/// set the environment variables to use your own OAuth app credentials.
fn github_client_id() -> String {
    std::env::var("VAPORGIT_GITHUB_CLIENT_ID")
        .unwrap_or_else(|_| "Ov23li87YrIgxujryQ0H".to_string())
}

fn github_client_secret() -> String {
    std::env::var("VAPORGIT_GITHUB_CLIENT_SECRET")
        .unwrap_or_else(|_| "8281894ca048efd5ea1c456cdc8fd918e0508682".to_string())
}

const GITHUB_AUTHORIZE_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL: &str = "https://api.github.com";
const KEYRING_SERVICE: &str = "VaporGit";
const KEYRING_USER: &str = "github_token";
const USER_AGENT: &str = "VaporGit/1.0";

// ── HTTP client helpers ───────────────────────────────────────

fn build_client(timeout_secs: u64) -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

fn default_client() -> Result<Client, String> {
    build_client(30)
}

// ── Authorization Code Flow with PKCE + WebView ───────────────

/// Start the OAuth Authorization Code Flow with PKCE using an in-app WebView.
///
/// 1. Open a Tauri WebView window to GitHub's authorization page.
/// 2. Intercept the callback redirect via `on_navigation`.
/// 3. Exchange the authorization code for a token.
/// 4. Save the token and return the authenticated user.
pub async fn start_auth_code_flow(app: tauri::AppHandle) -> Result<GitHubUser, String> {
    let token_store = TokenStore::new(TokenConfig {
        service_name: KEYRING_SERVICE,
        keyring_user: KEYRING_USER,
        file_name: "github_token",
    });
    let config = ProviderConfig {
        provider_name: "GitHub",
        client_id: github_client_id(),
        client_secret: github_client_secret(),
        authorize_url: GITHUB_AUTHORIZE_URL,
        token_url: GITHUB_TOKEN_URL,
        api_url: GITHUB_API_URL,
        scopes: "repo+user+read:org",
        user_agent: USER_AGENT,
        redirect_uri: "http://localhost:{port}/callback",
    };
    let token = start_oauth_flow(&config, &token_store, app).await?;
    get_current_user(&token).await
}

// ── In-memory token cache (fallback when keyring desyncs) ─────

static MEMORY_TOKEN: std::sync::OnceLock<std::sync::Mutex<Option<String>>> = std::sync::OnceLock::new();

fn memory_token() -> &'static std::sync::Mutex<Option<String>> {
    MEMORY_TOKEN.get_or_init(|| std::sync::Mutex::new(None))
}

// ── File-based token path (reliable fallback) ────────────────

fn token_file_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(appdata).join("VaporGit").join("github_token")
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("VaporGit").join("github_token")
    }
}

/// Load token from in-memory cache first, then OS keychain, then file.
pub fn load_token() -> Result<Option<String>, String> {
    // Check in-memory cache first (fast path, survives Tauri command boundary)
    if let Some(token) = memory_token().lock().unwrap().clone() {
        return Ok(Some(token));
    }

    // Try OS keychain
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        match entry.get_password() {
            Ok(token) => {
                *memory_token().lock().unwrap() = Some(token.clone());
                return Ok(Some(token));
            }
            Err(keyring::Error::NoEntry) => { /* fall through to file */ }
            Err(e) => {
                eprintln!("Failed to load token from keychain (non-fatal): {e}");
            }
        }
    }

    // Final fallback: file storage (reliable across restarts on Windows)
    let file_path = token_file_path();
    if file_path.exists() {
        match fs::read_to_string(&file_path) {
            Ok(token) => {
                let token = token.trim().to_string();
                if !token.is_empty() {
                    *memory_token().lock().unwrap() = Some(token.clone());
                    return Ok(Some(token));
                }
            }
            Err(e) => {
                eprintln!("Failed to read token file (non-fatal): {e}");
            }
        }
    }

    Ok(None)
}

/// Clear token from OS keychain, file, and in-memory cache.
pub fn clear_token() -> Result<(), String> {
    *memory_token().lock().unwrap() = None;

    if let Ok(entry) = Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        let _ = entry.delete_credential();
    }

    // Also remove the file
    let file_path = token_file_path();
    if file_path.exists() {
        let _ = fs::remove_file(&file_path);
    }

    Ok(())
}

// ── User info ─────────────────────────────────────────────────

/// Get current GitHub user info using the given token.
pub async fn get_current_user(token: &str) -> Result<GitHubUser, String> {
    let client = default_client()?;

    let resp = client
        .get(format!("{GITHUB_API_URL}/user"))
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Network error fetching user: {e}"))?;

    parse_github_response(resp).await
}

/// Check current auth status: load token and verify it with GitHub.
pub async fn check_auth() -> Result<AuthStatus, String> {
    match load_token()? {
        None => Ok(AuthStatus { authenticated: false, user: None }),
        Some(token) => match get_current_user(&token).await {
            Ok(user) => Ok(AuthStatus { authenticated: true, user: Some(user) }),
            Err(_) => {
                let _ = clear_token();
                Ok(AuthStatus { authenticated: false, user: None })
            }
        },
    }
}
