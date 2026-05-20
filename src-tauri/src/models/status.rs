use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub status: StatusKind,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StatusKind {
    WtNew,
    WtModified,
    WtDeleted,
    IndexNew,
    IndexModified,
    IndexDeleted,
    Conflicted,
    Renamed,
}
