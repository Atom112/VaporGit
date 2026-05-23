use crate::models::github::{GitHubBranch, GitHubRepo};
use crate::github::api::GitHubClient;
use serde::Serialize;

#[derive(Serialize)]
struct CreateRepoBody {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    private: bool,
}

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

    /// List branches for a repository.
    pub async fn list_branches(&self, owner: &str, repo: &str) -> Result<Vec<GitHubBranch>, String> {
        let path = format!("/repos/{}/{}/branches?per_page=100", owner, repo);
        self.get_json(&path).await
    }

    /// Create a new repository for the authenticated user.
    pub async fn create_repo(
        &self,
        name: &str,
        description: Option<&str>,
        private: bool,
    ) -> Result<GitHubRepo, String> {
        let body = CreateRepoBody {
            name: name.to_string(),
            description: description.map(|s| s.to_string()),
            private,
        };
        self.post_json("/user/repos", &body).await
    }
}
