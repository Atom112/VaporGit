use crate::models::github::{
    CreatePullRequest, GitHubPullRequest, MergePullRequest, MergePullResult, PRComment,
};
use crate::github::api::GitHubClient;

impl GitHubClient {
    /// List pull requests for a repository.
    pub async fn list_pulls(
        &self,
        owner: &str,
        repo: &str,
        state: Option<&str>,
        page: u32,
        per_page: u32,
    ) -> Result<Vec<GitHubPullRequest>, String> {
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
    ) -> Result<GitHubPullRequest, String> {
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        self.get_json(&path).await
    }

    /// Create a pull request.
    pub async fn create_pull(
        &self,
        owner: &str,
        repo: &str,
        request: &CreatePullRequest,
    ) -> Result<GitHubPullRequest, String> {
        let path = format!("/repos/{}/{}/pulls", owner, repo);
        self.post_json(&path, request).await
    }

    /// Merge a pull request.
    pub async fn merge_pull(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
        request: &MergePullRequest,
    ) -> Result<MergePullResult, String> {
        let path = format!("/repos/{}/{}/pulls/{}/merge", owner, repo, number);
        self.put_json(&path, request).await
    }

    /// Get the list of changed files in a pull request.
    pub async fn get_pull_files(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<Vec<crate::models::github::PullRequestFile>, String> {
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
        let path = format!("/repos/{}/{}/pulls/{}", owner, repo, number);
        self.get_text(&path, "application/vnd.github.v3.diff").await
    }

    /// List comments on a pull request.
    pub async fn list_pull_comments(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
    ) -> Result<Vec<PRComment>, String> {
        let path = format!("/repos/{}/{}/pulls/{}/comments", owner, repo, number);
        self.get_json(&path).await
    }

    /// Create a review comment on a pull request.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_pull_comment(
        &self,
        owner: &str,
        repo: &str,
        number: u32,
        body: &str,
        commit_id: &str,
        path: &str,
        position: u32,
    ) -> Result<PRComment, String> {
        let url = format!("/repos/{}/{}/pulls/{}/comments", owner, repo, number);
        #[derive(serde::Serialize)]
        struct CreateComment {
            body: String,
            commit_id: String,
            path: String,
            position: u32,
        }
        let req = CreateComment {
            body: body.to_string(),
            commit_id: commit_id.to_string(),
            path: path.to_string(),
            position,
        };
        self.post_json(&url, &req).await
    }
}
