use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub commit_id: String,
    pub timestamp: i64,
}
