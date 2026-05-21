use crate::github::parse_github_response;
use crate::models::github::{AuthStatus, GitHubUser};
use keyring::Entry;
use reqwest::Client;
use tokio::sync::oneshot;
use url::Url;

/// Register a GitHub OAuth App at https://github.com/settings/developers
/// and set this to your app's Client ID.
const GITHUB_CLIENT_ID: &str = "Ov23li87YrIgxujryQ0H";

/// Optional client secret for confidential apps.
const GITHUB_CLIENT_SECRET: &str = "8281894ca048efd5ea1c456cdc8fd918e0508682";

const GITHUB_AUTHORIZE_URL: &str = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL: &str = "https://api.github.com";
const KEYRING_SERVICE: &str = "VaporGit";
const KEYRING_USER: &str = "github_token";
const USER_AGENT: &str = "VaporGit/1.0";

// ── PKCE helpers ──────────────────────────────────────────────

use base64::engine::general_purpose::URL_SAFE_NO_PAD as Base64Url;
use base64::Engine;
use sha2::{Digest, Sha256};

fn generate_code_verifier() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("failed to generate random bytes");
    Base64Url.encode(&bytes)
}

fn code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    Base64Url.encode(hasher.finalize())
}

fn random_port() -> u16 {
    let mut bytes = [0u8; 2];
    getrandom::fill(&mut bytes).unwrap_or_default();
    (u16::from_be_bytes(bytes) % 15384) + 49152
}

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
    let verifier = generate_code_verifier();
    let challenge = code_challenge(&verifier);
    let port = random_port();
    let label = format!("github-oauth-{}", nanos());

    let auth_url = format!(
        "{GITHUB_AUTHORIZE_URL}?client_id={GITHUB_CLIENT_ID}&\
         redirect_uri=http://localhost:{port}/callback&\
         scope=repo+user+read:org&\
         response_type=code&\
         code_challenge={challenge}&\
         code_challenge_method=S256"
    );

    let url = Url::parse(&auth_url).map_err(|e| format!("Invalid authorization URL: {e}"))?;

    // Channel to receive the code from the navigation callback back to this async fn
    let (tx, rx) = oneshot::channel::<Result<String, String>>();
    let tx = std::sync::Mutex::new(Some(tx));

    let webview = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(url))
        .inner_size(800.0, 700.0)
        .resizable(false)
        .title("GitHub 授权")
        .on_navigation(move |url| {
            // Only intercept if this is a redirect to our localhost callback
            // (match host + port + path precisely, NOT the redirect_uri param in the
            // initial authorize URL, which also contains "localhost:PORT/callback")
            let is_callback = url.host_str() == Some("localhost")
                && url.port() == Some(port)
                && url.path() == "/callback";
            if !is_callback {
                return true;
            }

            if let Some(tx) = tx.lock().unwrap().take() {
                // Try to extract the authorization code
                if let Some(code) = url
                    .query_pairs()
                    .find(|(k, _)| k == "code")
                    .map(|(_, v)| v.to_string())
                {
                    let _ = tx.send(Ok(code));
                } else {
                    // Extract error description if present
                    let msg = url
                        .query_pairs()
                        .find(|(k, _)| k == "error_description")
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_else(|| "授权被拒绝".to_string());
                    let _ = tx.send(Err(msg));
                }
            }

            false // Prevent navigation to localhost
        })
        .build()
        .map_err(|e| format!("无法打开授权窗口: {e}"))?;

    // Wait for the callback to deliver the code
    let code = match rx.await {
        Ok(Ok(code)) => code,
        Ok(Err(e)) => {
            let _ = webview.close();
            return Err(e);
        }
        Err(_) => {
            // Channel closed = user closed the window
            let _ = webview.close();
            return Err("用户取消了授权".to_string());
        }
    };

    let _ = webview.close();

    // Exchange the code for an access token
    let token = exchange_code_for_token(&code, &verifier, port).await?;

    // Persist the token and fetch user info
    save_token(&token)?;
    get_current_user(&token).await
}

fn nanos() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

/// Exchange the authorization code for an access token using PKCE.
async fn exchange_code_for_token(code: &str, verifier: &str, port: u16) -> Result<String, String> {
    let client = build_client(10)?;

    let mut params = vec![
        ("client_id", GITHUB_CLIENT_ID.to_string()),
        ("code", code.to_string()),
        ("redirect_uri", format!("http://localhost:{port}/callback")),
        ("code_verifier", verifier.to_string()),
    ];
    if !GITHUB_CLIENT_SECRET.is_empty() {
        params.push(("client_secret", GITHUB_CLIENT_SECRET.to_string()));
    }

    let resp = client
        .post(GITHUB_TOKEN_URL)
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error exchanging code: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed ({status}): {body}"));
    }

    let body: serde_json::Value =
        resp.json().await.map_err(|e| format!("Failed to parse token response: {e}"))?;

    if let Some(token) = body.get("access_token").and_then(|v| v.as_str()) {
        return Ok(token.to_string());
    }

    if let Some(desc) = body.get("error_description").and_then(|v| v.as_str()) {
        return Err(desc.to_string());
    }
    if let Some(error) = body.get("error").and_then(|v| v.as_str()) {
        return Err(error.to_string());
    }

    Err("Unknown error during token exchange".to_string())
}

// ── In-memory token cache (fallback when keyring desyncs) ─────

static MEMORY_TOKEN: std::sync::OnceLock<std::sync::Mutex<Option<String>>> = std::sync::OnceLock::new();

fn memory_token() -> &'static std::sync::Mutex<Option<String>> {
    MEMORY_TOKEN.get_or_init(|| std::sync::Mutex::new(None))
}

// ── Token persistence ─────────────────────────────────────────

/// Save token to both OS keychain and in-memory cache.
pub fn save_token(token: &str) -> Result<(), String> {
    // Always cache in memory first
    *memory_token().lock().unwrap() = Some(token.to_string());

    // Persist to OS keychain (best-effort, in-memory cache is the fallback)
    match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => {
            let _ = entry.set_password(token);
        }
        Err(e) => {
            eprintln!("Keyring entry creation failed (non-fatal): {e}");
        }
    }
    Ok(())
}

/// Load token from in-memory cache first, then OS keychain.
pub fn load_token() -> Result<Option<String>, String> {
    // Check in-memory cache first (fast path, survives Tauri command boundary)
    if let Some(token) = memory_token().lock().unwrap().clone() {
        return Ok(Some(token));
    }

    // Fallback to OS keychain
    match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => match entry.get_password() {
            Ok(token) => {
                // Re-populate memory cache
                *memory_token().lock().unwrap() = Some(token.clone());
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => {
                eprintln!("Failed to load token from keychain (non-fatal): {e}");
                Ok(None)
            }
        },
        Err(e) => {
            eprintln!("Keyring entry creation failed (non-fatal): {e}");
            Ok(None)
        }
    }
}

/// Clear token from both OS keychain and in-memory cache.
pub fn clear_token() -> Result<(), String> {
    *memory_token().lock().unwrap() = None;

    match Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => {
            let _ = entry.delete_credential();
        }
        Err(e) => {
            eprintln!("Keyring entry creation failed (non-fatal): {e}");
        }
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
