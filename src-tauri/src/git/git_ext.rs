use crate::git::validate::{validate_ref_name, validate_relative_path};
use crate::models::git_ext::{BlameLine, LfsOperationResult, ReflogEntry, SshConnectionResult};
use git2::Repository;
use std::path::{Path, PathBuf};
use std::process::Command;

fn workdir(repo: &Repository) -> Result<PathBuf, String> {
    repo.workdir()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法获取工作目录".to_string())
}

fn validate_path(repo: &Repository, path: &str) -> Result<PathBuf, String> {
    validate_relative_path(path)?;
    let root = workdir(repo)?;
    let full = root.join(path);
    let root = root
        .canonicalize()
        .map_err(|e| format!("无法规范化工作目录: {}", e))?;
    let canonical = full.canonicalize().unwrap_or(full);
    if !canonical.starts_with(root) {
        return Err(format!("路径 '{}' 在仓库工作目录之外", path));
    }
    Ok(canonical)
}

fn run_git(repo: &Repository, args: &[&str]) -> Result<LfsOperationResult, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workdir(repo)?)
        .output()
        .map_err(|e| format!("无法执行 git 命令，请确认 Git 已安装: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(LfsOperationResult {
        success: output.status.success(),
        output: combined,
    })
}

fn ensure_lfs_available(repo: &Repository) -> Result<(), String> {
    let result = run_git(repo, &["lfs", "version"])?;
    if result.success {
        Ok(())
    } else {
        Err("git-lfs 不可用，请先安装 Git LFS".to_string())
    }
}

pub fn submodule_add(repo: &Repository, url: &str, path: &str) -> Result<String, String> {
    if url.trim().is_empty() {
        return Err("子模块 URL 不能为空".to_string());
    }
    validate_path(repo, path)?;
    let result = run_git(repo, &["submodule", "add", url.trim(), path])?;
    if result.success {
        Ok(result.output)
    } else {
        Err(format!("添加子模块失败: {}", result.output))
    }
}

pub fn submodule_init(repo: &Repository) -> Result<String, String> {
    let result = run_git(repo, &["submodule", "init"])?;
    if result.success {
        Ok(result.output)
    } else {
        Err(format!("初始化子模块失败: {}", result.output))
    }
}

pub fn submodule_update(repo: &Repository, recursive: bool) -> Result<String, String> {
    let args = if recursive {
        vec!["submodule", "update", "--init", "--recursive"]
    } else {
        vec!["submodule", "update", "--init"]
    };
    let result = run_git(repo, &args)?;
    if result.success {
        Ok(result.output)
    } else {
        Err(format!("更新子模块失败: {}", result.output))
    }
}

pub fn git_blame(repo: &Repository, file_path: &str) -> Result<Vec<BlameLine>, String> {
    let full_path = validate_path(repo, file_path)?;
    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("无法读取文件 '{}': {}", file_path, e))?;
    let lines: Vec<&str> = content.lines().collect();
    let blame = repo
        .blame_file(Path::new(file_path), None)
        .map_err(|e| format!("无法获取 blame: {}", e))?;

    let mut result = Vec::new();
    for (index, content) in lines.iter().enumerate() {
        let line_number = index + 1;
        let Some(hunk) = blame.get_line(line_number) else {
            continue;
        };
        let oid = hunk.final_commit_id();
        let commit = repo.find_commit(oid).ok();
        let (author, summary) = commit
            .as_ref()
            .map(|commit| {
                (
                    commit.author().name().unwrap_or("Unknown").to_string(),
                    commit.summary().unwrap_or("").to_string(),
                )
            })
            .unwrap_or_else(|| ("Unknown".to_string(), String::new()));
        let id = oid.to_string();
        result.push(BlameLine {
            line_number: line_number as u32,
            short_id: id[..8.min(id.len())].to_string(),
            commit_id: id,
            author,
            summary,
            content: (*content).to_string(),
        });
    }

    Ok(result)
}

pub fn get_reflog(repo: &Repository, reference: Option<&str>) -> Result<Vec<ReflogEntry>, String> {
    let reference = reference.unwrap_or("HEAD");
    if reference != "HEAD" {
        validate_ref_name(reference)?;
    }
    let reflog = repo
        .reflog(reference)
        .map_err(|e| format!("无法读取 reflog: {}", e))?;
    let mut entries = Vec::new();
    for index in 0..reflog.len() {
        if let Some(entry) = reflog.get(index) {
            let committer = entry.committer();
            entries.push(ReflogEntry {
                index,
                old_id: entry.id_old().to_string(),
                new_id: entry.id_new().to_string(),
                message: entry.message().unwrap_or("").to_string(),
                committer: committer.name().unwrap_or("Unknown").to_string(),
                timestamp: committer.when().seconds(),
            });
        }
    }
    Ok(entries)
}

pub fn lfs_pull(repo: &Repository) -> Result<LfsOperationResult, String> {
    ensure_lfs_available(repo)?;
    run_git(repo, &["lfs", "pull"])
}

pub fn lfs_track(repo: &Repository, pattern: &str) -> Result<LfsOperationResult, String> {
    validate_lfs_pattern(pattern)?;
    ensure_lfs_available(repo)?;
    run_git(repo, &["lfs", "track", pattern])
}

pub fn lfs_untrack(repo: &Repository, pattern: &str) -> Result<LfsOperationResult, String> {
    validate_lfs_pattern(pattern)?;
    ensure_lfs_available(repo)?;
    run_git(repo, &["lfs", "untrack", pattern])
}

fn validate_lfs_pattern(pattern: &str) -> Result<(), String> {
    if pattern.trim().is_empty() {
        return Err("LFS 匹配规则不能为空".to_string());
    }
    if pattern.contains('\0') || pattern.contains("..") || pattern.starts_with('-') {
        return Err("LFS 匹配规则包含不安全字符".to_string());
    }
    Ok(())
}

pub fn test_ssh_connection(host: &str, key_path: Option<&str>) -> Result<SshConnectionResult, String> {
    validate_ssh_host(host)?;
    if let Some(path) = key_path {
        if path.contains('\0') || path.trim().is_empty() {
            return Err("SSH 密钥路径无效".to_string());
        }
    }

    let mut command = Command::new("ssh");
    command.args(["-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"]);
    if let Some(path) = key_path {
        command.args(["-i", path]);
    }
    command.arg(format!("git@{host}"));

    let output = command
        .output()
        .map_err(|e| format!("无法执行 ssh，请确认 SSH 客户端已安装: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(SshConnectionResult {
        success: output.status.success() || combined.contains("successfully authenticated"),
        host: host.to_string(),
        output: combined,
    })
}

fn validate_ssh_host(host: &str) -> Result<(), String> {
    let valid = !host.is_empty()
        && host.len() <= 253
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    if valid {
        Ok(())
    } else {
        Err("SSH 主机名无效".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use std::fs;

    fn repo_with_commit() -> (tempfile::TempDir, Repository) {
        let temp = tempfile::tempdir().expect("tempdir");
        let repo = Repository::init(temp.path()).expect("init repo");
        fs::write(temp.path().join("README.md"), "line one\nline two\n").expect("write file");
        let mut index = repo.index().expect("index");
        index.add_path(std::path::Path::new("README.md")).expect("add");
        let tree_id = index.write_tree().expect("tree");
        {
            let tree = repo.find_tree(tree_id).expect("find tree");
            let sig = Signature::now("Test", "test@example.com").expect("sig");
            repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
                .expect("commit");
        }
        (temp, repo)
    }

    #[test]
    fn rejects_unsafe_lfs_patterns() {
        assert!(validate_lfs_pattern("../secret").is_err());
        assert!(validate_lfs_pattern("-danger").is_err());
        assert!(validate_lfs_pattern("*.bin").is_ok());
    }

    #[test]
    fn validates_ssh_hosts() {
        assert!(validate_ssh_host("github.com").is_ok());
        assert!(validate_ssh_host("bad host").is_err());
        assert!(validate_ssh_host("bad/host").is_err());
    }

    #[test]
    fn returns_blame_lines_for_tracked_file() {
        let (_temp, repo) = repo_with_commit();
        let blame = git_blame(&repo, "README.md").expect("blame");
        assert_eq!(blame.len(), 2);
        assert_eq!(blame[0].author, "Test");
    }

    #[test]
    fn returns_head_reflog_entries() {
        let (_temp, repo) = repo_with_commit();
        let entries = get_reflog(&repo, None).expect("reflog");
        assert!(!entries.is_empty());
    }
}
