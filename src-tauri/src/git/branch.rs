use std::cell::RefCell;
use git2::Repository;
use crate::models::branch::{BranchInfo, BranchDiffSummary, BranchFileChange};

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
    // Validate branch name
    crate::git::validate::validate_ref_name(name)?;

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

    // Check if this is the current branch
    let head = repo.head().ok();
    if let Some(h) = head {
        if let Some(shorthand) = h.shorthand() {
            if shorthand == name {
                return Err(format!("无法删除当前检出的分支 '{}'，请先切换到其他分支", name));
            }
        }
    }

    branch
        .delete()
        .map_err(|e| format!("删除分支失败: {}", e))?;

    Ok(())
}

pub fn delete_remote_branch(repo: &Repository, remote_name: &str, branch_name: &str) -> Result<(), String> {
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("无法找到远程 {}: {}", remote_name, e))?;

    let refspec = format!(":refs/heads/{}", branch_name);

    // Try loading tokens for HTTPS authentication (supports GitHub + Gitee)
    let github_token = crate::github::auth::load_token().ok().flatten();
    let gitee_token = crate::gitee::auth::token_store().load().ok().flatten();
    let remote_url = remote.url().map(|u| u.to_string());
    let remote_host = remote_url.as_ref().and_then(|u| crate::git::remote::extract_host(u));
    let is_https = remote_url.as_ref().is_some_and(|u| u.starts_with("https://"));

    let mut cb = git2::RemoteCallbacks::new();
    cb.credentials(move |_url, username_from_url, allowed| {
        if is_https && allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(ref host) = remote_host {
                if host == "github.com" || host.ends_with(".github.com") {
                    if let Some(ref token) = github_token {
                        return git2::Cred::userpass_plaintext("x-access-token", token);
                    }
                } else if host == "gitee.com" || host.ends_with(".gitee.com") {
                    if let Some(ref token) = gitee_token {
                        return git2::Cred::userpass_plaintext("oauth2", token);
                    }
                }
            }
        }
        let user = username_from_url.unwrap_or("git");
        git2::Cred::ssh_key_from_agent(user).or_else(|_| git2::Cred::default())
    });

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(cb);

    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| format!("删除远程分支失败: {}", e))?;

    remote
        .disconnect()
        .map_err(|e| format!("断开远程连接失败: {}", e))?;

    Ok(())
}

/// Compare two branches: get ahead/behind counts and file-level diff.
pub fn compare_branches(
    repo: &Repository,
    base_branch: &str,
    target_branch: &str,
) -> Result<BranchDiffSummary, String> {
    let base_obj = repo
        .revparse_single(base_branch)
        .map_err(|e| format!("无法解析分支 '{}': {}", base_branch, e))?;
    let target_obj = repo
        .revparse_single(target_branch)
        .map_err(|e| format!("无法解析分支 '{}': {}", target_branch, e))?;

    let base_commit = base_obj
        .peel_to_commit()
        .map_err(|e| format!("无法获取分支 '{}' 的提交: {}", base_branch, e))?;
    let target_commit = target_obj
        .peel_to_commit()
        .map_err(|e| format!("无法获取分支 '{}' 的提交: {}", target_branch, e))?;

    // Find merge-base
    let merge_base_oid = repo
        .merge_base(base_commit.id(), target_commit.id())
        .map_err(|e| format!("无法计算合并基础: {}", e))?;

    // Ahead/behind counts (ahead = commits on target not on base, behind = commits on base not on target)
    let (ahead, behind) = repo
        .graph_ahead_behind(base_commit.id(), target_commit.id())
        .map_err(|e| format!("无法计算 ahead/behind: {}", e))?;

    // Diff between merge-base and target (what target has that base doesn't)
    let merge_base_tree = repo
        .find_commit(merge_base_oid)
        .map_err(|e| format!("无法找到合并基础提交: {}", e))?
        .tree()
        .map_err(|e| format!("无法获取合并基础树: {}", e))?;

    let target_tree = target_commit
        .tree()
        .map_err(|e| format!("无法获取目标分支树: {}", e))?;

    let diff = repo
        .diff_tree_to_tree(Some(&merge_base_tree), Some(&target_tree), None)
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let files = RefCell::new(Vec::<BranchFileChange>::new());

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
            files.borrow_mut().push(BranchFileChange {
                file_path,
                status: status.to_string(),
                additions: 0,
                deletions: 0,
            });
            true
        },
        None,
        None,
        Some(&mut |_delta, _hunk, line| {
            let mut f = files.borrow_mut();
            if let Some(last) = f.last_mut() {
                match line.origin() {
                    '+' => last.additions += 1,
                    '-' => last.deletions += 1,
                    _ => {}
                }
            }
            true
        }),
    )
    .map_err(|e| format!("遍历 diff 失败: {}", e))?;

    Ok(BranchDiffSummary {
        ahead,
        behind,
        files: files.into_inner(),
        base_branch: base_branch.to_string(),
        target_branch: target_branch.to_string(),
    })
}
