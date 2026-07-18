use crate::git_err;
use crate::models::remote::RemoteInfo;
use git2::{Cred, RemoteCallbacks, Repository};
use url::Url;

/// Extract the hostname from a git remote URL, handling both HTTPS and SSH formats.
/// - "https://github.com/user/repo.git" → "github.com"
/// - "git@github.com:user/repo.git" → "github.com"
/// - "ssh://git@github.com/user/repo" → "github.com"
pub(crate) fn extract_host(url: &str) -> Option<String> {
    // Try HTTPS/SSh URL parsing first
    if let Ok(parsed) = Url::parse(url) {
        if let Some(host) = parsed.host_str() {
            return Some(host.to_string());
        }
    }
    // Handle SCP-style SSH URLs: git@github.com:user/repo.git
    if let Some(at_pos) = url.find('@') {
        let after_at = &url[at_pos + 1..];
        if let Some(colon_pos) = after_at.find(':') {
            let host = &after_at[..colon_pos];
            // Filter out Windows paths (C:\) and port numbers
            if !host.contains('/') && !host.contains('\\') && host.contains('.') {
                return Some(host.to_string());
            }
        }
    }
    None
}

/// Get the push URL (or fallback URL) for a named remote.
pub fn get_push_url(repo: &Repository, remote_name: &str) -> Result<String, String> {
    let remote = repo
        .find_remote(remote_name)
        .map_err(|e| git_err!("REMOTE_NOT_FOUND", "Remote '{}' not found: {}", remote_name, e))?;
    remote
        .pushurl()
        .map(|u| u.to_string())
        .or_else(|| remote.url().map(|u| u.to_string()))
        .ok_or_else(|| git_err!("REMOTE_NO_URL", "Remote '{}' has no URL", remote_name))
}

pub fn get_remotes(repo: &Repository) -> Result<Vec<RemoteInfo>, String> {
    let remotes = repo
        .remotes()
        .map_err(|e| git_err!("REMOTE_LIST_FAILED", "Failed to get remote list: {}", e))?;

    let mut result = Vec::new();
    for name in remotes.iter().flatten() {
        let remote = repo
            .find_remote(name)
            .map_err(|e| git_err!("REMOTE_NOT_FOUND", "Remote '{}' not found: {}", name, e))?;

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

pub fn add_remote(repo: &Repository, name: &str, url: &str) -> Result<(), String> {
    repo.remote(name, url)
        .map_err(|e| git_err!("REMOTE_ADD_FAILED", "Failed to add remote '{}': {}", name, e))?;
    Ok(())
}

pub fn set_remote_url(repo: &Repository, name: &str, url: &str) -> Result<(), String> {
    repo.remote_set_url(name, url)
        .map_err(|e| git_err!("REMOTE_ADD_FAILED", "Failed to set remote URL: {}", e))?;
    Ok(())
}

pub fn delete_remote(repo: &Repository, name: &str) -> Result<(), String> {
    repo.remote_delete(name)
        .map_err(|e| git_err!("REMOTE_DELETE_FAILED", "Failed to delete remote '{}': {}", name, e))?;
    Ok(())
}

pub fn fetch(repo: &Repository, remote_name: Option<&str>) -> Result<(), String> {
    let name = remote_name.unwrap_or("origin");
    let mut remote = repo
        .find_remote(name)
        .map_err(|e| git_err!("REMOTE_NOT_FOUND", "Remote '{}' not found: {}", name, e))?;

    // Load platform tokens for HTTPS authentication (same as push)
    let github_token = crate::github::auth::load_token().ok().flatten();
    let gitee_token = crate::gitee::auth::token_store().load().ok().flatten();
    let remote_url = remote.url().map(|u| u.to_string());

    let remote_host = remote_url.as_ref().and_then(|u| extract_host(u));
    let is_https = remote_url.as_ref().is_some_and(|u| u.starts_with("https://"));

    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, username_from_url, allowed| {
        if is_https && allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(ref host) = remote_host {
                if host == "github.com" || host.ends_with(".github.com") {
                    if let Some(ref token) = github_token {
                        return Cred::userpass_plaintext("x-access-token", token);
                    }
                } else if host == "gitee.com" || host.ends_with(".gitee.com") {
                    if let Some(ref token) = gitee_token {
                        return Cred::userpass_plaintext("oauth2", token);
                    }
                }
            }
        }
        let user = username_from_url.unwrap_or("git");
        git2::Cred::ssh_key_from_agent(user).or_else(|_| git2::Cred::default())
    });

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(cb);

    remote
        .fetch(&["refs/heads/*:refs/remotes/origin/*"], Some(&mut fetch_opts), None)
        .map_err(|e| git_err!("REMOTE_FETCH_FAILED", "Fetch failed: {}", e))?;

    remote
        .disconnect()
        .map_err(|e| git_err!("REMOTE_DISCONNECT", "Failed to disconnect remote: {}", e))?;

    Ok(())
}

pub fn pull(repo: &Repository, remote_name: Option<&str>, branch: Option<&str>) -> Result<String, String> {
    let name = remote_name.unwrap_or("origin");
    fetch(repo, Some(name))?;

    let fetch_head = repo
        .find_reference("FETCH_HEAD")
        .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to find FETCH_HEAD: {}", e))?;

    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to resolve FETCH_HEAD: {}", e))?;

    let (analysis, _pref) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Merge analysis failed: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok("Already up-to-date".to_string());
    }

    if analysis.is_fast_forward() {
        // Detect current branch name if not provided
        let current_branch = branch.map(|b| b.to_string()).or_else(|| {
            repo.head().ok().and_then(|h| h.shorthand().map(|s| s.to_string()))
        }).unwrap_or_else(|| "main".to_string());

        let remote_branch = if current_branch.contains('/') {
            current_branch.clone()
        } else {
            format!("{}/{}", name, current_branch)
        };

        let ff_ref = remote_branch.as_str();

        let mut reference = repo
            .find_reference(ff_ref)
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to find reference: {}", e))?;

        reference
            .set_target(fetch_commit.id(), "Fast-forward pull")
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Fast-forward merge failed: {}", e))?;

        repo.set_head(reference.name().unwrap_or("refs/heads/main"))
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to set HEAD: {}", e))?;

        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Checkout failed: {}", e))?;

        return Ok("Fast-forward merge complete".to_string());
    }

    if analysis.is_normal() {
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        repo.merge(
            &[&fetch_commit],
            None,
            Some(&mut checkout_builder),
        )
        .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Merge failed: {}", e))?;

        let mut index = repo
            .index()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to get index: {}", e))?;

        if index.has_conflicts() {
            return Ok("Merge conflicts detected, please resolve manually".to_string());
        }

        let tree_oid = index
            .write_tree()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to write tree: {}", e))?;

        let signature = repo
            .signature()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to get signature: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to find tree: {}", e))?;

        let head_commit = repo
            .head()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to get HEAD: {}", e))?
            .peel_to_commit()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to get HEAD commit: {}", e))?;

        let merge_commit = repo
            .find_commit(fetch_commit.id())
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to find merge commit: {}", e))?;

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Merge remote-tracking branch",
            &tree,
            &[&head_commit, &merge_commit],
        )
        .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Merge commit failed: {}", e))?;

        repo.cleanup_state()
            .map_err(|e| git_err!("REMOTE_PULL_FAILED", "Failed to cleanup state: {}", e))?;

        return Ok("Merge complete".to_string());
    }

    Ok("Pull complete".to_string())
}

pub fn push(repo: &Repository, remote_name: Option<&str>, branch: Option<&str>) -> Result<(), String> {
    let name = remote_name.unwrap_or("origin");
    let mut remote = repo
        .find_remote(name)
        .map_err(|e| git_err!("REMOTE_NOT_FOUND", "Remote '{}' not found: {}", name, e))?;

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
    let remote_host = remote_url.as_ref().and_then(|u| extract_host(u));
    let is_https = remote_url.as_ref().is_some_and(|u| u.starts_with("https://"));

    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |_url, username_from_url, allowed| {
        if is_https && allowed.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Some(ref host) = remote_host {
                if host == "github.com" || host.ends_with(".github.com") {
                    if let Some(ref token) = github_token {
                        return Cred::userpass_plaintext("x-access-token", token);
                    }
                } else if host == "gitee.com" || host.ends_with(".gitee.com") {
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
        .map_err(|e| git_err!("REMOTE_PUSH_FAILED", "Push failed: {}", e))?;

    remote
        .disconnect()
        .map_err(|e| git_err!("REMOTE_DISCONNECT", "Failed to disconnect remote: {}", e))?;

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
                .map_err(|e| git_err!("REMOTE_ADD_FAILED", "Failed to set remote URL: {}", e))?;
            r
        }
        Err(_) => repo
            .remote(remote_name, remote_url)
            .map_err(|e| git_err!("REMOTE_ADD_FAILED", "Failed to create remote '{}': {}", remote_name, e))?,
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
        .map_err(|e| git_err!("REMOTE_PUSH_FAILED", "Push failed: {}", e))?;

    remote
        .disconnect()
        .map_err(|e| git_err!("REMOTE_DISCONNECT", "Failed to disconnect remote: {}", e))?;

    Ok(())
}
