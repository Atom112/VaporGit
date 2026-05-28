use crate::oauth::token::TokenStore;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as Base64Url;
use base64::Engine;
use reqwest::Client;
use sha2::{Digest, Sha256};
use tokio::sync::oneshot;
use url::Url;

pub struct ProviderConfig {
    pub provider_name: &'static str,
    pub client_id: &'static str,
    pub client_secret: &'static str,
    pub authorize_url: &'static str,
    pub token_url: &'static str,
    pub api_url: &'static str,
    pub scopes: &'static str,
    pub user_agent: &'static str,
    /// Redirect URI template. Use `{port}` as placeholder for the random port.
    /// E.g. `"http://localhost:{port}/callback"` (dynamic port) or `"http://localhost"` (fixed, for providers
    /// that don't support port wildcards).
    pub redirect_uri: &'static str,
}

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

fn build_client(timeout_secs: u64, user_agent: &str) -> Result<Client, String> {
    Client::builder()
        .user_agent(user_agent)
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

fn nanos() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

/// Start the OAuth Authorization Code Flow with PKCE using an in-app WebView.
///
/// 1. Open a Tauri WebView window to the provider's authorization page.
/// 2. Intercept the callback redirect via `on_navigation`.
/// 3. Exchange the authorization code for a token.
/// 4. Save the token via `token_store`.
/// 5. Return the access token string.
pub async fn start_auth_code_flow(
    config: &ProviderConfig,
    token_store: &TokenStore,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let verifier = generate_code_verifier();
    let challenge = code_challenge(&verifier);
    let port = random_port();
    let label = format!("{}-oauth-{}", config.provider_name, nanos());

    let redirect_uri = config.redirect_uri.replace("{port}", &port.to_string());
    let redirect_url = Url::parse(&redirect_uri)
        .map_err(|e| format!("Invalid redirect URI: {e}"))?;
    let redirect_host = redirect_url.host_str().unwrap_or("localhost").to_string();
    let redirect_port = redirect_url.port();
    let redirect_path = redirect_url.path().to_string();

    let auth_url = format!(
        "{}?client_id={}&\
         redirect_uri={}&\
         scope={}&\
         response_type=code&\
         code_challenge={}&\
         code_challenge_method=S256",
        config.authorize_url, config.client_id, redirect_uri, config.scopes, challenge,
    );

    let url = Url::parse(&auth_url).map_err(|e| format!("Invalid authorization URL: {e}"))?;

    let (tx, rx) = oneshot::channel::<Result<String, String>>();
    let tx = std::sync::Mutex::new(Some(tx));

    let webview = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(url))
        .inner_size(800.0, 700.0)
        .resizable(false)
        .title(format!("{} 授权", config.provider_name))
        .on_navigation(move |url| {
            let host_match = url.host_str() == Some(&redirect_host);
            let port_match = url.port() == redirect_port;
            let path_match = url.path() == redirect_path
                || (redirect_path == "/" && (url.path() == "" || url.path() == "/"));
            let is_callback = host_match && port_match && path_match;
            if !is_callback {
                return true;
            }

            if let Some(tx) = tx.lock().unwrap().take() {
                if let Some(code) = url
                    .query_pairs()
                    .find(|(k, _)| k == "code")
                    .map(|(_, v)| v.to_string())
                {
                    let _ = tx.send(Ok(code));
                } else {
                    let msg = url
                        .query_pairs()
                        .find(|(k, _)| k == "error_description")
                        .map(|(_, v)| v.to_string())
                        .unwrap_or_else(|| "授权被拒绝".to_string());
                    let _ = tx.send(Err(msg));
                }
            }

            false
        })
        .build()
        .map_err(|e| format!("无法打开授权窗口: {e}"))?;

    let code = match rx.await {
        Ok(Ok(code)) => code,
        Ok(Err(e)) => {
            let _ = webview.close();
            return Err(e);
        }
        Err(_) => {
            let _ = webview.close();
            return Err("用户取消了授权".to_string());
        }
    };

    let _ = webview.close();

    let token = exchange_code_for_token(config, &code, &verifier, &redirect_uri).await?;

    token_store.save(&token)?;
    Ok(token)
}

/// Exchange the authorization code for an access token.
async fn exchange_code_for_token(
    config: &ProviderConfig,
    code: &str,
    verifier: &str,
    redirect_uri: &str,
) -> Result<String, String> {
    let client = build_client(10, config.user_agent)?;

    let mut params = vec![
        ("grant_type", "authorization_code".to_string()),
        ("client_id", config.client_id.to_string()),
        ("code", code.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
        ("code_verifier", verifier.to_string()),
    ];
    if !config.client_secret.is_empty() {
        params.push(("client_secret", config.client_secret.to_string()));
    }

    let resp = client
        .post(config.token_url)
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error exchanging code: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
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

pub async fn fetch_current_user(
    config: &ProviderConfig,
    token: &str,
) -> Result<serde_json::Value, String> {
    let client = build_client(30, config.user_agent)?;

    let resp = client
        .get(format!("{}/user", config.api_url))
        .header("Accept", "application/json")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Network error fetching user: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    let mut json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("返回数据格式错误: {}", e))?;

    crate::oauth::response::keys_snake_to_camel(&mut json);

    Ok(json)
}
