use git2::{Oid, Repository, Sort};
use crate::models::commit::{CommitInfo, CommitDetail, FileChange};

pub fn commit(repo: &Repository, message: &str) -> Result<CommitInfo, String> {
    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("无法写入树: {}", e))?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("无法找到树: {}", e))?;

    let head = repo.head().ok();
    let parent_commits: Vec<_> = head
        .iter()
        .filter_map(|h| h.peel_to_commit().ok())
        .collect();
    let parents: Vec<&git2::Commit> = parent_commits.iter().collect();

    let commit_oid = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            parents.as_slice(),
        )
        .map_err(|e| format!("提交失败: {}", e))?;

    let commit = repo
        .find_commit(commit_oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    commit_to_info(&commit)
}

pub fn get_commit_history(
    repo: &Repository,
    page: u32,
    page_size: u32,
) -> Result<Vec<CommitInfo>, String> {
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("无法创建 revwalk: {}", e))?;

    revwalk.set_sorting(Sort::TIME).map_err(|e| format!("无法设置排序: {}", e))?;
    revwalk
        .push_head()
        .map_err(|e| format!("无法推送 HEAD: {}", e))?;

    let skip = (page * page_size) as usize;
    let take = page_size as usize;

    let oids: Vec<Oid> = revwalk
        .filter_map(|r| r.ok())
        .skip(skip)
        .take(take)
        .collect();

    let mut commits = Vec::new();
    for oid in oids {
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("无法找到提交: {}", e))?;
        commits.push(commit_to_info(&commit)?);
    }

    Ok(commits)
}

pub fn get_commit_detail(repo: &Repository, commit_id: &str) -> Result<CommitDetail, String> {
    let oid = Oid::from_str(commit_id).map_err(|e| format!("无效的提交 ID: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    let parent_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok());

    let current_tree = commit.tree().map_err(|e| format!("无法获取树: {}", e))?;

    let diff = repo
        .diff_tree_to_tree(
            parent_tree.as_ref(),
            Some(&current_tree),
            None,
        )
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let mut changed_files = Vec::new();

    diff.foreach(
        &mut |delta, _| {
            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                _ => "other",
            };

            let file_path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            changed_files.push(FileChange {
                file_path,
                status: status.to_string(),
                additions: 0,
                deletions: 0,
            });
            true
        },
        None,
        None,
        None,
    )
    .map_err(|e| format!("遍历 diff 失败: {}", e))?;

    let info = commit_to_info(&commit)?;

    Ok(CommitDetail {
        id: info.id,
        short_id: info.short_id,
        message: info.message,
        author: info.author,
        email: info.email,
        timestamp: info.timestamp,
        parent_ids: info.parent_ids,
        changed_files,
    })
}

fn commit_to_info(commit: &git2::Commit) -> Result<CommitInfo, String> {
    let id = commit.id();
    let id_str = id.to_string();
    let short_id = id_str[..8.min(id_str.len())].to_string();
    let message = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();
    let author = commit.author();
    let timestamp = commit.time().seconds();
    let parent_ids: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();

    Ok(CommitInfo {
        id: id_str,
        short_id,
        message,
        author: author.name().unwrap_or("Unknown").to_string(),
        email: author.email().unwrap_or("").to_string(),
        timestamp,
        parent_ids,
    })
}