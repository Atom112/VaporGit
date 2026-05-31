use crate::models::gitee::{GiteeAuthStatus, GiteeUser};
use crate::oauth::flow::{fetch_current_user, start_auth_code_flow, ProviderConfig};
use crate::oauth::token::{TokenConfig, TokenStore};

fn gitee_client_id() -> String {
    std::env::var("VAPORGIT_GITEE_CLIENT_ID")
        .unwrap_or_else(|_| "5681aca9ea54ed91a7d2e434c277760eb039fbcd171253b0aefae1d96161f7f8".to_string())
}

fn gitee_client_secret() -> String {
    std::env::var("VAPORGIT_GITEE_CLIENT_SECRET")
        .unwrap_or_else(|_| "4ef407bdcf8f06f96c153748d7a6616257808540b70a8420ba0020e72afb25ec".to_string())
}

const AUTHORIZE_URL: &str = "https://gitee.com/oauth/authorize";
const TOKEN_URL: &str = "https://gitee.com/oauth/token";
const API_URL: &str = "https://gitee.com/api/v5";
const SCOPES: &str = "user_info projects pull_requests";
const USER_AGENT: &str = "VaporGit/1.0";

fn config() -> ProviderConfig {
    ProviderConfig {
        provider_name: "gitee",
        client_id: gitee_client_id(),
        client_secret: gitee_client_secret(),
        authorize_url: AUTHORIZE_URL,
        token_url: TOKEN_URL,
        api_url: API_URL,
        scopes: SCOPES,
        user_agent: USER_AGENT,
        redirect_uri: "http://localhost",
    }
}

pub(crate) fn token_store() -> TokenStore {
    TokenStore::new(TokenConfig {
        service_name: "VaporGit",
        keyring_user: "gitee_token",
        file_name: "gitee_token",
    })
}

pub async fn start_auth(app: tauri::AppHandle) -> Result<GiteeUser, String> {
    let token = start_auth_code_flow(&config(), &token_store(), app).await?;
    get_current_user(&token).await
}

pub async fn get_current_user(token: &str) -> Result<GiteeUser, String> {
    let json = fetch_current_user(&config(), token).await?;
    serde_json::from_value(json).map_err(|e| format!("解析用户信息失败: {}", e))
}

pub async fn check_auth() -> Result<GiteeAuthStatus, String> {
    match token_store().load()? {
        None => Ok(GiteeAuthStatus { authenticated: false, user: None }),
        Some(token) => match get_current_user(&token).await {
            Ok(user) => Ok(GiteeAuthStatus { authenticated: true, user: Some(user) }),
            Err(_) => {
                let _ = token_store().clear();
                Ok(GiteeAuthStatus { authenticated: false, user: None })
            }
        },
    }
}

pub fn clear_token() -> Result<(), String> {
    token_store().clear()
}
