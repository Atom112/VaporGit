use crate::github::parse_github_response;
use crate::models::github::GitHubUser;
use reqwest::Client;
use serde::Serialize;

const GITHUB_API_URL: &str = "https://api.github.com";
const USER_AGENT: &str = "VaporGit/1.0";

pub struct GitHubClient {
    token: String,
    client: Client,
}

impl GitHubClient {
    /// Create a new GitHub API client with the given OAuth token.
    pub fn new(token: String) -> Result<Self, String> {
        let client = Client::builder()
            .user_agent(USER_AGENT)
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self { token, client })
    }

    fn auth_value(&self) -> String {
        format!("Bearer {}", self.token)
    }

    fn check_response_status(&self, status: u16, body: &str) -> Result<(), String> {
        if status == 401 {
            return Err("unauthorized".to_string());
        }
        if status == 403 {
            return Err("rate_limited".to_string());
        }
        if !(200..300).contains(&status) {
            return Err(format!("GitHub API error ({}): {}", status, body));
        }
        Ok(())
    }

    pub(crate) async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, String> {
        let url = format!("{}{}", GITHUB_API_URL, path);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_github_response(resp).await
    }

    pub(crate) async fn post_json<T: Serialize, R: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R, String> {
        let url = format!("{}{}", GITHUB_API_URL, path);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_github_response(resp).await
    }

    pub(crate) async fn put_json<T: Serialize, R: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R, String> {
        let url = format!("{}{}", GITHUB_API_URL, path);
        let resp = self
            .client
            .put(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_github_response(resp).await
    }

    pub(crate) async fn get_text(&self, path: &str, accept: &str) -> Result<String, String> {
        let url = format!("{}{}", GITHUB_API_URL, path);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", accept)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            self.check_response_status(status.as_u16(), &body)?;
            return Err(format!("GitHub API error ({}): {}", status, body));
        }

        resp.text().await.map_err(|e| format!("Failed to read response: {}", e))
    }

    /// Get the authenticated user's profile.
    pub async fn get_current_user(&self) -> Result<GitHubUser, String> {
        self.get_json("/user").await
    }
}
