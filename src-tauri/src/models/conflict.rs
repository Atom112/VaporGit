use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntry {
    pub file_path: String,
    pub ancestor_mode: Option<u32>,
    pub ours_mode: Option<u32>,
    pub theirs_mode: Option<u32>,
}

/// Detailed info about a single conflict block within a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictBlockDetail {
    pub block_index: usize,
    pub ours_content: String,
    pub theirs_content: String,
    pub start_line: u32,
    pub end_line: u32,
}

/// A per-block resolution instruction sent from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockResolution {
    pub block_index: usize,
    pub action: String,          // "ours" | "theirs" | "manual"
    pub custom_content: String,  // used when action == "manual"
}
