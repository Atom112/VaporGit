use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parent_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetail {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parent_ids: Vec<String>,
    pub changed_files: Vec<FileChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub file_path: String,
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
}
