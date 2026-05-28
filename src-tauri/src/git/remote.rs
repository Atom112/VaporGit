use crate::models::remote::RemoteInfo;
use git2::{Cred, RemoteCallbacks, Repository};

/// Get the push URL (or fallback URL) for a named remote.
pub fn get_push_url(repo: &Repository, remote_name: &str) -> Result<String, String> {
    let remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("无法找到远程 {}: {}", remote_name, e))?;
    remote
        .pushurl()
        .map(|u| u.to_string())
        .or_else(|| remote.url().map(|u| u.to_string()))
        .ok_or_else(|| format!("远程 {} 没有 URL", remote_name))
}

pub fn get_remotes(repo: &Repository) -> Result<Vec<RemoteInfo>, String> {
    let remotes = repo
        .remotes()
        .map_err(|e| format!("无法获取远程列表: {}", e))?;

    let mut result = Vec::new();
    for name in remotes.iter().flatten() {
        let remote = repo
            .find_remote(name)
            .map_err(|e| format!("无法找到远程 {}: {}", name, e))?;

        let url = remote.url().unwrap_or("").to_string();
        let push_url = remote.pushurl().map(|u| u.to_string()).unwrap_or_else(|| url.clone());

        result.push(RemoteInfo {
            name: name.to_string(),
            url,
            push_url,
        });
    }

    Ok(result)
}

pub fn fetch(repo: &Repository, remote_name: Option<&str>) -> Result<(), String> {
    let name = remote_name.unwrap_or("origin");
    let mut remote = repo
        .find_remote(name)
        .map_err(|e| format!("无法找到远程 {}: {}", name, e))?;

    let mut cb = RemoteCallbacks::new();
    cb.credentials(|_url, username_from_url, _allowed_types| {
        let user = username_from_url.unwrap_or("git");
        git2::Cred::ssh_key_from_agent(user).or_else(|_| git2::Cred::default())
    });

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(cb);

    remote
        .fetch(&["refs/heads/*:refs/remotes/origin/*"], Some(&mut fetch_opts), None)
        .map_err(|e| e.to_string())?;

    remote
        .disconnect()
        .map_err(|e| format!("断开远程连接失败: {}", e))?;

    Ok(())
}

pub fn pull(repo: &Repository, remote_name: Option<&str>, branch: Option<&str>) -> Result<String, String> {
    let name = remote_name.unwrap_or("origin");
    fetch(repo, Some(name))?;

    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| format!("无法找到 FETCH_HEAD: {}", e))?;

    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| format!("无法解析 FETCH_HEAD: {}", e))?;

    let (analysis, _pref) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("合并分析失败: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok("Already up to date.".to_string());
    }

    if analysis.is_fast_forward() {
        let remote_branch = branch.map(|b| {
            if b.contains('/') {
                b.to_string()
            } else {
                format!("{}/{}", name, b)
            }
        });

        let ff_ref = remote_branch
            .as_deref()
            .unwrap_or("refs/heads/main");

        let mut reference = repo
            .find_reference(ff_ref)
            .map_err(|e| format!("无法找到引用: {}", e))?;

        reference
            .set_target(fetch_commit.id(), "Fast-forward pull")
            .map_err(|e| format!("Fast-forward 失败: {}", e))?;

        repo.set_head(reference.name().unwrap_or("refs/heads/main"))
            .map_err(|e| format!("设置 HEAD 失败: {}", e))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| format!("检出失败: {}", e))?;

        return Ok("Fast-forward merged.".to_string());
    }

    if analysis.is_normal() {
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        repo.merge(
            &[&fetch_commit],
            None,
            Some(&mut checkout_builder),
        )
        .map_err(|e| format!("合并失败: {}", e))?;

        let mut index = repo
            .index()
            .map_err(|e| format!("无法获取索引: {}", e))?;

        if index.has_conflicts() {
            return Ok("Merge conflicts detected. Please resolve manually.".to_string());
        }

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("无法写入树: {}", e))?;

        let signature = repo
            .signature()
            .map_err(|e| format!("无法获取签名: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("无法找到树: {}", e))?;

        let head_commit = repo
            .head()
            .map_err(|e| format!("无法获取 HEAD: {}", e))?
            .peel_to_commit()
            .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

        let merge_commit = repo
            .find_commit(fetch_commit.id())
            .map_err(|e| format!("无法找到合并提交: {}", e))?;

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Merge remote-tracking branch",
            &tree,
            &[&head_commit, &merge_commit],
        )
        .map_err(|e| format!("合并提交失败: {}", e))?;

        repo.cleanup_state()
            .map_err(|e| format!("清理状态失败: {}", e))?;

        return Ok("Merge completed.".to_string());
    }

    Ok("Pull completed.".to_string())
}

pub fn push(repo: &Repository, remote_name: Option<&str>, branch: Option<&str>) -> Result<(), String> {
    let name = remote_name.unwrap_or("origin");
    let mut remote = repo
        .find_remote(name)
        .map_err(|e| format!("无法找到远程 {}: {}", name, e))?;

    let branch_name: String = match branch {
        Some(b) => b.to_string(),
        None => repo
            .head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "main".to_string()),
    };

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    // Load platform tokens for HTTPS authentication
    let github_token = crate::github::auth::load_token().ok().flatten();
    let gitee_token = crate::gitee::auth::token_store().load().ok().flatten();
    let remote_url = remote.pushurl().map(|u| u.to_string()).or_else(|| remote.url().map(|u| u.to_string()));

    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, username_from_url, allowed| {
        if let Some(ref url) = remote_url {
            if url.starts_with("https://") && allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
                if url.contains("github.com") {
                    if let Some(ref token) = github_token {
                        return Cred::userpass_plaintext("x-access-token", token);
                    }
                } else if url.contains("gitee.com") {
                    if let Some(ref token) = gitee_token {
                        return Cred::userpass_plaintext("oauth2", token);
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
        .map_err(|e| e.to_string())?;

    remote
        .disconnect()
        .map_err(|e| format!("断开远程连接失败: {}", e))?;

    Ok(())
}

/// Push a branch to a GitHub remote using HTTPS token authentication.
/// Sets up the remote URL without embedding the token in the config.
pub fn push_with_github_token(
    repo: &Repository,
    remote_name: &str,
    remote_url: &str,
    token: &str,
    branch: &str,
) -> Result<(), String> {
    // Try to find the remote, or create it
    let mut remote = match repo.find_remote(remote_name) {
        Ok(r) => {
            // Update URL to the HTTPS URL without token
            repo.remote_set_url(remote_name, remote_url)
                .map_err(|e| format!("无法设置远程 URL: {}", e))?;
            r
        }
        Err(_) => repo
            .remote(remote_name, remote_url)
            .map_err(|e| format!("无法创建远程 {}: {}", remote_name, e))?,
    };

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);

    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, _username, allowed| {
        if allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            Cred::userpass_plaintext("x-access-token", token)
        } else {
            Cred::default()
        }
    });

    let mut push_opts = git2::PushOptions::new();
    push_opts.remote_callbacks(cb);

    remote
        .push(&[&refspec], Some(&mut push_opts))
        .map_err(|e| e.to_string())?;

    remote
        .disconnect()
        .map_err(|e| format!("断开远程连接失败: {}", e))?;

    Ok(())
}