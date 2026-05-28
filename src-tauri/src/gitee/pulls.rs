use crate::gitee::api::GiteeClient;
use crate::models::gitee::{
    GiteeCreatePullRequest, GiteeMergePullRequest, GiteeMergePullResult, GiteePRComment,
    GiteePullRequest, GiteePullRequestFile,
};

impl GiteeClient {
    /// List pull requests for a repository.
    pub async fn list_pulls(
        &self,
        owner: &str,
        repo: &str,
        state: Option<&str>,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<GiteePullRequest>, String> {
        let s = state.unwrap_or("open");
        let path = format!(
            "/repos/{}/{}/pulls?state={}&page={}&per_page={}&sort=updated&direction=desc",
            owner, repo, s, page, per_page
        );
        self.get_json(&path).await
    }

    /// Get a single pull request by number.
    pub async fn get_pull(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<GiteePullRequest, String> {
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        self.get_json(&path).await
    }

    /// Create a pull request.
    pub async fn create_pull(
        &self,
        owner: &str,
        repo: &str,
        request: &GiteeCreatePullRequest,
    ) -> Result<GiteePullRequest, String> {
        let path = format!("/repos/{}/{}/pulls", owner, repo);
        self.post_json(&path, request).await
    }

    /// Merge a pull request.
    pub async fn merge_pull(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
        request: &GiteeMergePullRequest,
    ) -> Result<GiteeMergePullResult, String> {
        let path = format!("/repos/{}/{}/pulls/{}/merge", owner, repo, number);
        self.put_json(&path, request).await
    }

    /// Get the list of changed files in a pull request.
    pub async fn get_pull_files(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<Vec<GiteePullRequestFile>, String> {
        let path = format!("/repos/{}/{}/pulls/{}/files", owner, repo, number);
        self.get_json(&path).await
    }

    /// Get the raw diff for a pull request.
    pub async fn get_pull_diff(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<String, String> {
        let path = format!("/repos/{}/{}/pulls/{}.diff", owner, repo, number);
        self.get_text(&path, "application/json").await
    }

    /// List comments on a pull request.
    pub async fn list_pull_comments(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<Vec<GiteePRComment>, String> {
        let path = format!("/repos/{}/{}/pulls/{}/comments", owner, repo, number);
        self.get_json(&path).await
    }
}
