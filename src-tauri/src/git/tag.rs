use git2::{Oid, Repository};
use crate::git_err;

/// Create a lightweight tag pointing to the given commit.
pub fn create_tag(
    repo: &Repository,
    commit_id: &str,
    tag_name: &str,
) -> Result<String, String> {
    // Validate tag name
    crate::git::validate::validate_ref_name(tag_name)?;

    let oid = Oid::from_str(commit_id).map_err(|e| git_err!("TAG_INVALID_COMMIT_ID", "Invalid commit ID: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| git_err!("TAG_COMMIT_NOT_FOUND", "Commit not found: {}", e))?;

    let object = commit.as_object();
    repo.tag_lightweight(tag_name, object, false)
        .map_err(|e| git_err!("TAG_CREATE_FAILED", "Failed to create tag: {}", e))?;

    Ok(format!("Tag '{}' created successfully", tag_name))
}
