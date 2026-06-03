#[derive(Debug, PartialEq)]
pub enum Platform {
    GitHub,
    Gitee,
}

#[derive(Debug)]
pub struct ParsedRemoteUrl {
    pub platform: Platform,
    #[allow(dead_code)]
    pub owner: String,
    pub repo_name: String,
}

/// Parse a remote URL to extract platform, owner, and repo name.
///
/// Supports formats:
///   - https://github.com/owner/repo[.git]
///   - https://gitee.com/owner/repo[.git]
///   - git@github.com:owner/repo[.git]
///   - git@gitee.com:owner/repo[.git]
pub fn parse_remote_url(url: &str) -> Result<ParsedRemoteUrl, String> {
    let url = url.strip_suffix(".git").unwrap_or(url);

    let (host, path) = if url.starts_with("https://") {
        let without_scheme = url.strip_prefix("https://").ok_or("invalid URL")?;
        let slash_pos = without_scheme.find('/').ok_or_else(|| format!("invalid URL: {}", url))?;
        let host = &without_scheme[..slash_pos];
        let path = &without_scheme[slash_pos + 1..];
        (host, path)
    } else if url.contains('@') && url.contains(':') {
        let after_at = url.split('@').nth(1).ok_or_else(|| format!("invalid SSH URL: {}", url))?;
        let colon_pos = after_at.find(':').ok_or_else(|| format!("invalid SSH URL: {}", url))?;
        let host = &after_at[..colon_pos];
        let path = &after_at[colon_pos + 1..];
        (host, path)
    } else {
        return Err(format!("unsupported remote URL format: {}", url));
    };

    let platform = match host {
        h if h.contains("github.com") => Platform::GitHub,
        h if h.contains("gitee.com") => Platform::Gitee,
        _ => {
            return Err(format!(
                "unsupported platform in remote URL: {} (only github.com and gitee.com are supported)",
                host
            ))
        }
    };

    let path = path.trim_start_matches('/');
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() < 2 {
        return Err(format!("cannot extract owner/repo from URL: {}", url));
    }
    let owner = parts[0].to_string();
    let repo_name = parts[1].to_string();

    Ok(ParsedRemoteUrl { platform, owner, repo_name })
}

/// Detect whether an error indicates the remote itself doesn't exist in local git config.
pub fn is_remote_not_found_error(err: &str) -> bool {
    err.contains("无法找到远程")
        || (err.contains("remote '") && err.contains("does not exist"))
        || (err.contains("remote '") && err.contains("not found"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_https() {
        let parsed = parse_remote_url("https://github.com/owner/repo.git").unwrap();
        assert_eq!(parsed.platform, Platform::GitHub);
        assert_eq!(parsed.owner, "owner");
        assert_eq!(parsed.repo_name, "repo");
    }

    #[test]
    fn test_github_https_no_dot_git() {
        let parsed = parse_remote_url("https://github.com/user/my-project").unwrap();
        assert_eq!(parsed.platform, Platform::GitHub);
        assert_eq!(parsed.owner, "user");
        assert_eq!(parsed.repo_name, "my-project");
    }

    #[test]
    fn test_github_ssh() {
        let parsed = parse_remote_url("git@github.com:owner/repo.git").unwrap();
        assert_eq!(parsed.platform, Platform::GitHub);
        assert_eq!(parsed.owner, "owner");
        assert_eq!(parsed.repo_name, "repo");
    }

    #[test]
    fn test_gitee_https() {
        let parsed = parse_remote_url("https://gitee.com/user/repo.git").unwrap();
        assert_eq!(parsed.platform, Platform::Gitee);
        assert_eq!(parsed.owner, "user");
        assert_eq!(parsed.repo_name, "repo");
    }

    #[test]
    fn test_gitee_ssh() {
        let parsed = parse_remote_url("git@gitee.com:user/repo.git").unwrap();
        assert_eq!(parsed.platform, Platform::Gitee);
        assert_eq!(parsed.owner, "user");
        assert_eq!(parsed.repo_name, "repo");
    }

    #[test]
    fn test_invalid_url() {
        let result = parse_remote_url("not-a-url");
        assert!(result.is_err());
    }

    #[test]
    fn test_is_remote_not_found() {
        assert!(is_remote_not_found_error("无法找到远程 origin"));
        assert!(is_remote_not_found_error("无法找到远程 upstream: remote 'upstream' does not exist"));
        assert!(is_remote_not_found_error("remote 'origin' not found"));
        assert!(!is_remote_not_found_error("Repository not found"));
        assert!(!is_remote_not_found_error("其他错误"));
    }
}
