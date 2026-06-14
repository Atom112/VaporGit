use git2::Repository;
use std::fs;
use std::path::Path;
use crate::models::repo::RepoInfo;

pub fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| format!("无法打开仓库: {}", e))
}

/// Check if a repository has submodules and return their names.
pub fn check_submodules(repo: &Repository) -> Result<Vec<String>, String> {
    let mut submodules = Vec::new();
    // Check for .gitmodules file in the working directory
    let workdir = match repo.workdir() {
        Some(dir) => dir.to_path_buf(),
        None => return Ok(vec![]),
    };
    let gitmodules_path = workdir.join(".gitmodules");
    if !gitmodules_path.exists() {
        return Ok(vec![]);
    }

    // Use git2's submodule API to get submodule names
    repo.submodules()
        .unwrap_or_default()
        .iter()
        .for_each(|sm| {
            if let Some(name) = sm.name() {
                submodules.push(name.to_string());
            }
        });

    // Fallback: parse .gitmodules file directly if git2 didn't find any
    if submodules.is_empty() {
        if let Ok(content) = std::fs::read_to_string(&gitmodules_path) {
            for line in content.lines() {
                if let Some(name) = line.trim().strip_prefix("[submodule \"") {
                    if let Some(name) = name.strip_suffix("\"]") {
                        submodules.push(name.to_string());
                    }
                }
            }
        }
    }

    Ok(submodules)
}

fn extract_repo_name(url: &str) -> Option<String> {
    url.trim_end_matches(".git")
        .trim_end_matches('/')
        .split('/')
        .next_back()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

pub fn clone_repo(url: &str, path: &str) -> Result<(Repository, RepoInfo), String> {
    let target_path = Path::new(path);

    // If the target exists and is not empty, derive a repo name from the URL
    // and clone into a new subdirectory instead of failing.
    let actual_path = if target_path.exists() {
        let is_empty = target_path
            .read_dir()
            .map(|mut d| d.next().is_none())
            .unwrap_or(false);
        if is_empty {
            path.to_string()
        } else {
            let repo_name =
                extract_repo_name(url).ok_or_else(|| "无法从 URL 解析仓库名称".to_string())?;
            let new_path = target_path.join(&repo_name);
            if new_path.exists() {
                let new_is_empty = new_path
                    .read_dir()
                    .map(|mut d| d.next().is_none())
                    .unwrap_or(false);
                if !new_is_empty {
                    return Err(format!(
                        "目标目录 '{}' 已存在且不为空",
                        new_path.display()
                    ));
                }
            }
            new_path.to_string_lossy().to_string()
        }
    } else {
        path.to_string()
    };

    let repo = Repository::clone(url, &actual_path)
        .map_err(|e| format!("克隆仓库失败: {}", e))?;
    let info = get_repo_info(&repo, &actual_path)?;
    Ok((repo, info))
}

pub fn init_repo(path: &str, init_readme: bool) -> Result<RepoInfo, String> {
    let repo_path = Path::new(path);

    if !repo_path.exists() {
        fs::create_dir_all(repo_path).map_err(|e| format!("无法创建目录: {}", e))?;
    } else if repo_path.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false) {
        return Err(format!("目录 '{}' 不为空", path));
    }

    let repo = Repository::init(path).map_err(|e| format!("初始化仓库失败: {}", e))?;

    if init_readme {
        let repo_name = repo_path
            .file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_else(|| std::borrow::Cow::Borrowed("project"));

        fs::write(
            repo_path.join("README.md"),
            format!("# {}\n\nVaporGit 创建的项目\n", repo_name),
        )
        .map_err(|e| format!("无法创建 README.md: {}", e))?;

        let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
        index
            .add_path(Path::new("README.md"))
            .map_err(|e| format!("无法暂存 README.md: {}", e))?;

        let tree_oid = index
            .write_tree()
            .map_err(|e| format!("无法写入树对象: {}", e))?;

        let tree = repo
            .find_tree(tree_oid)
            .map_err(|e| format!("无法找到树对象: {}", e))?;

        let signature = git2::Signature::now("VaporGit", "vaporgit@local")
            .map_err(|e| format!("无法创建签名: {}", e))?;

        repo.commit(Some("HEAD"), &signature, &signature, "Initial commit", &tree, &[])
            .map_err(|e| format!("无法创建初始提交: {}", e))?;
    }

    get_repo_info(&repo, path)
}

pub fn get_repo_info(repo: &Repository, path: &str) -> Result<RepoInfo, String> {
    let head = repo.head().ok();
    let head_branch = head
        .as_ref()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));
    let head_commit = head
        .as_ref()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());
    let is_detached = head.as_ref().map(|h| h.is_remote()).unwrap_or(false)
        || repo.head_detached().unwrap_or(false);

    let state_summary = if repo.state() != git2::RepositoryState::Clean {
        format!("{:?}", repo.state())
    } else {
        "Clean".to_string()
    };

    let is_bare = repo.is_bare();

    Ok(RepoInfo {
        path: path.to_string(),
        head_branch,
        head_commit,
        is_bare,
        is_detached,
        state_summary,
    })
}
