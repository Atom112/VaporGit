use crate::oauth::response::parse_platform_response;
use reqwest::Client;
use serde::Serialize;

const GITEE_API_URL: &str = "https://gitee.com/api/v5";
const USER_AGENT: &str = "VaporGit/1.0";

pub struct GiteeClient {
    token: String,
    client: Client,
}

impl GiteeClient {
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

    pub(crate) async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, String> {
        let url = format!("{}{}", GITEE_API_URL, path);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_platform_response(resp).await
    }

    pub(crate) async fn post_json<T: Serialize, R: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R, String> {
        let url = format!("{}{}", GITEE_API_URL, path);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_platform_response(resp).await
    }

    #[allow(dead_code)]
    pub(crate) async fn put_json<T: Serialize, R: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<R, String> {
        let url = format!("{}{}", GITEE_API_URL, path);
        let resp = self
            .client
            .put(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        parse_platform_response(resp).await
    }

    #[allow(dead_code)]
    pub(crate) async fn get_text(&self, path: &str, accept: &str) -> Result<String, String> {
        let url = format!("{}{}", GITEE_API_URL, path);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.auth_value())
            .header("Accept", accept)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = resp.status();
        let body = resp.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            return Err(format!("HTTP {}: {}", status, body));
        }

        Ok(body)
    }

    pub async fn get_current_user(&self) -> Result<crate::models::gitee::GiteeUser, String> {
        self.get_json("/user").await
    }
}
