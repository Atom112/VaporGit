use git2::{Oid, Repository};
use crate::models::git_ext::TagInfo;

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

pub fn list_tags(repo: &Repository) -> Result<Vec<TagInfo>, String> {
    let names = repo
        .tag_names(None)
        .map_err(|e| format!("无法读取标签列表: {}", e))?;

    let mut tags = Vec::new();
    for name in names.iter().flatten() {
        let reference_name = format!("refs/tags/{name}");
        let reference = repo
            .find_reference(&reference_name)
            .map_err(|e| format!("无法读取标签 '{}': {}", name, e))?;
        let object = reference
            .peel(git2::ObjectType::Any)
            .map_err(|e| format!("无法解析标签 '{}': {}", name, e))?;
        let message = object
            .as_tag()
            .and_then(|tag| tag.message().map(ToString::to_string));

        tags.push(TagInfo {
            name: name.to_string(),
            target: object.id().to_string(),
            message,
        });
    }

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

pub fn delete_tag(repo: &Repository, tag_name: &str) -> Result<String, String> {
    crate::git::validate::validate_ref_name(tag_name)?;
    let reference_name = format!("refs/tags/{tag_name}");
    let mut reference = repo
        .find_reference(&reference_name)
        .map_err(|e| format!("无法找到标签 '{}': {}", tag_name, e))?;
    reference
        .delete()
        .map_err(|e| format!("删除标签失败: {}", e))?;
    Ok(format!("标签 '{}' 已删除", tag_name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use std::fs;

    fn repo_with_commit() -> (tempfile::TempDir, Repository, String) {
        let temp = tempfile::tempdir().expect("tempdir");
        let repo = Repository::init(temp.path()).expect("init repo");
        fs::write(temp.path().join("README.md"), "hello\n").expect("write file");
        let mut index = repo.index().expect("index");
        index.add_path(std::path::Path::new("README.md")).expect("add");
        let tree_id = index.write_tree().expect("tree");
        let oid = {
            let tree = repo.find_tree(tree_id).expect("find tree");
            let sig = Signature::now("Test", "test@example.com").expect("sig");
            repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
                .expect("commit")
        };
        (temp, repo, oid.to_string())
    }

    #[test]
    fn lists_and_deletes_lightweight_tags() {
        let (_temp, repo, commit_id) = repo_with_commit();

        create_tag(&repo, &commit_id, "v1.0.0").expect("create tag");
        let tags = list_tags(&repo).expect("list tags");
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "v1.0.0");

        delete_tag(&repo, "v1.0.0").expect("delete tag");
        assert!(list_tags(&repo).expect("list after delete").is_empty());
    }
}
