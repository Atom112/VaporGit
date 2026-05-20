use crate::git;
use crate::models::branch::BranchInfo;

#[tauri::command]
pub fn get_branch_list(path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = git::repo::open_repo(&path)?;
    git::branch::get_branch_list(&repo)
}

#[tauri::command]
pub fn create_branch(path: String, name: String, from: Option<String>) -> Result<(), String> {
    let repo = git::repo::open_repo(&path)?;
    git::branch::create_branch(&repo, &name, from.as_deref())
}

#[tauri::command]
pub fn checkout_branch(path: String, name: String) -> Result<(), String> {
    let repo = git::repo::open_repo(&path)?;
    git::branch::checkout_branch(&repo, &name)
}

#[tauri::command]
pub fn delete_branch(path: String, name: String) -> Result<(), String> {
    let repo = git::repo::open_repo(&path)?;
    git::branch::delete_branch(&repo, &name)
}