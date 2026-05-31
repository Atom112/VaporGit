use git2::{Oid, Repository};

/// Create a lightweight tag pointing to the given commit.
pub fn create_tag(
    repo: &Repository,
    commit_id: &str,
    tag_name: &str,
) -> Result<String, String> {
    // Validate tag name
    crate::git::validate::validate_ref_name(tag_name)?;

    let oid = Oid::from_str(commit_id).map_err(|e| format!("无效的提交 ID: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    let object = commit.as_object();
    repo.tag_lightweight(tag_name, object, false)
        .map_err(|e| format!("创建标签失败: {}", e))?;

    Ok(format!("标签 '{}' 创建成功", tag_name))
}
