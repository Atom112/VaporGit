use git2::Repository;
use crate::models::branch::BranchInfo;

pub fn get_branch_list(repo: &Repository) -> Result<Vec<BranchInfo>, String> {
    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut result = Vec::new();

    // Local branches
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch in branches {
            let (branch, _branch_type) = branch.map_err(|e| format!("遍历分支失败: {}", e))?;
            let name = branch
                .name()
                .map_err(|e| format!("获取分支名失败: {}", e))?
                .unwrap_or("unknown")
                .to_string();

            let is_head = head_name.as_deref() == Some(&name);

            let upstream_name = branch
                .upstream()
                .ok()
                .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

            let (ahead, behind) = if let Ok(upstream) = branch.upstream() {
                let upstream_oid = upstream.get().target();
                let local_oid = branch.get().target();
                if let (Some(u), Some(l)) = (upstream_oid, local_oid) {
                    let (a, b) = repo
                        .graph_ahead_behind(l, u)
                        .unwrap_or((0, 0));
                    (a, b)
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            };

            let last_commit = branch
                .get()
                .peel_to_commit()
                .ok()
                .map(|c| c.id().to_string());

            result.push(BranchInfo {
                name,
                is_head,
                is_remote: false,
                upstream: upstream_name,
                ahead,
                behind,
                last_commit,
            });
        }
    }

    // Remote-tracking branches (origin/*)
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Remote)) {
        for branch in branches {
            let (branch, _branch_type) = branch.map_err(|e| format!("遍历远程分支失败: {}", e))?;
            let name = branch
                .name()
                .map_err(|e| format!("获取远程分支名失败: {}", e))?
                .unwrap_or("unknown")
                .to_string();

            let last_commit = branch
                .get()
                .peel_to_commit()
                .ok()
                .map(|c| c.id().to_string());

            result.push(BranchInfo {
                name,
                is_head: false,
                is_remote: true,
                upstream: None,
                ahead: 0,
                behind: 0,
                last_commit,
            });
        }
    }

    Ok(result)
}

pub fn create_branch(repo: &Repository, name: &str, from: Option<&str>) -> Result<(), String> {
    let target = match from {
        Some(ref_name) => {
            let obj = repo
                .revparse_single(ref_name)
                .map_err(|e| format!("无法解析引用 {}: {}", ref_name, e))?;
            obj
        }
        None => {
            let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
            head.peel_to_commit()
                .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?
                .into_object()
        }
    };

    repo.branch(name, &target.into_commit().map_err(|_| "无法转为提交".to_string())?, false)
        .map_err(|e| format!("创建分支失败: {}", e))?;

    Ok(())
}

pub fn checkout_branch(repo: &Repository, name: &str) -> Result<(), String> {
    let (object, reference) = repo
        .revparse_ext(name)
        .map_err(|e| format!("无法解析分支 {}: {}", name, e))?;

    repo.checkout_tree(&object, None)
        .map_err(|e| format!("切换失败: {}", e))?;

    match reference {
        Some(gref) => repo.set_head(gref.name().unwrap_or(name)),
        None => repo.set_head_detached(object.id()),
    }
    .map_err(|e| format!("设置 HEAD 失败: {}", e))?;

    Ok(())
}

/// Checkout a remote-tracking branch by creating a local tracking branch from it.
/// e.g. `origin/dev` → creates local `dev` tracking `origin/dev`, then checks it out.
pub fn checkout_remote_branch(repo: &Repository, remote_ref: &str) -> Result<(), String> {
    // Parse remote branch ref to get the object
    let object = repo
        .revparse_single(remote_ref)
        .map_err(|e| format!("无法解析远程分支 {}: {}", remote_ref, e))?
        .peel_to_commit()
        .map_err(|_| format!("无法获取远程分支 {} 的提交对象", remote_ref))?;

    // Derive local branch name: "origin/dev" → "dev"
    let local_name = remote_ref
        .split('/')
        .skip(1)
        .collect::<Vec<_>>()
        .join("/");

    if local_name.is_empty() {
        return Err(format!("无效的远程分支引用: {}", remote_ref));
    }

    // Check if local branch already exists
    if repo.find_branch(&local_name, git2::BranchType::Local).is_ok() {
        // Branch exists — just check it out directly
        return checkout_branch(repo, &local_name);
    }

    // Create local branch at the remote's commit with tracking
    let mut branch = repo
        .branch(&local_name, &object, false)
        .map_err(|e| format!("创建本地分支 {} 失败: {}", local_name, e))?;

    // Set upstream to the remote branch
    branch
        .set_upstream(Some(remote_ref))
        .map_err(|e| format!("设置上游跟踪失败: {}", e))?;

    // Checkout the new branch
    repo.checkout_tree(object.as_object(), None)
        .map_err(|e| format!("切换失败: {}", e))?;

    let full_ref = format!("refs/heads/{}", local_name);
    repo.set_head(&full_ref)
        .map_err(|e| format!("设置 HEAD 失败: {}", e))?;

    Ok(())
}

pub fn delete_branch(repo: &Repository, name: &str) -> Result<(), String> {
    let mut branch = repo
        .find_branch(name, git2::BranchType::Local)
        .map_err(|e| format!("无法找到分支 {}: {}", name, e))?;

    branch
        .delete()
        .map_err(|e| format!("删除分支失败: {}", e))?;

    Ok(())
}