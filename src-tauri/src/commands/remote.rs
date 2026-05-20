use crate::git;

#[tauri::command]
pub fn fetch(path: String, remote: Option<String>) -> Result<(), String> {
    let repo = git::repo::open_repo(&path)?;
    git::remote::fetch(&repo, remote.as_deref())
}

#[tauri::command]
pub fn pull(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    let repo = git::repo::open_repo(&path)?;
    git::remote::pull(&repo, remote.as_deref(), branch.as_deref())
}

#[tauri::command]
pub fn push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    let repo = git::repo::open_repo(&path)?;
    git::remote::push(&repo, remote.as_deref(), branch.as_deref())
}