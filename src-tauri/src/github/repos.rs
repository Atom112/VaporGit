use crate::models::github::GitHubRepo;
use crate::github::api::GitHubClient;

impl GitHubClient {
    /// List repositories for the authenticated user.
    pub async fn list_user_repos(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<GitHubRepo>, String> {
        let path = format!(
            "/user/repos?page={}&per_page={}&sort=updated&direction=desc&type=all",
            page, per_page
        );
        self.get_json(&path).await
    }

    /// Get a single repository by owner and name.
    pub async fn get_repo(&self, owner: &str, repo: &str) -> Result<GitHubRepo, String> {
        let path = format!("/repos/{}/{}", owner, repo);
        self.get_json(&path).await
    }
}
