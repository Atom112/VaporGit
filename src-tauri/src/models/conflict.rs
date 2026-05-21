use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntry {
    pub file_path: String,
    pub ancestor_mode: Option<u32>,
    pub ours_mode: Option<u32>,
    pub theirs_mode: Option<u32>,
}
