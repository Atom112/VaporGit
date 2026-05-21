use crate::git;
use crate::models::conflict::ConflictEntry;
use crate::models::repo::{RecentRepo, RepoInfo};
use std::fs;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(appdata).join("VaporGit")
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".config").join("VaporGit")
    }
}

fn ensure_config_dir() -> Result<PathBuf, String> {
    let path = config_dir();
    fs::create_dir_all(&path).map_err(|e| format!("无法创建配置目录: {}", e))?;
    Ok(path)
}

#[tauri::command]
pub async fn open_repo(path: String) -> Result<RepoInfo, String> {
    let path_clone = path.clone();
    let info = tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        let info = git::repo::get_repo_info(&repo, &path)?;
        Ok::<_, String>(info)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?;

    save_repo_path_inner(&path_clone)?;
    info
}

#[tauri::command]
pub async fn get_recent_repos() -> Vec<RecentRepo> {
    let path = config_dir().join("recent_repos.json");
    if !path.exists() {
        return vec![];
    }
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    serde_json::from_str(&content).unwrap_or_default()
}

#[tauri::command]
pub async fn save_repo_path(path: String) -> Result<(), String> {
    save_repo_path_inner(&path)
}

#[tauri::command]
pub async fn remove_recent_repo(path: String) -> Result<(), String> {
    let config_dir = ensure_config_dir()?;
    let file_path = config_dir.join("recent_repos.json");

    let mut repos: Vec<RecentRepo> = if file_path.exists() {
        let content =
            fs::read_to_string(&file_path).map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    repos.retain(|r| r.path != path);

    let content =
        serde_json::to_string_pretty(&repos).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&file_path, content).map_err(|e| format!("写入配置失败: {}", e))?;

    Ok(())
}

fn save_repo_path_inner(path: &str) -> Result<(), String> {
    let config_dir = ensure_config_dir()?;
    let file_path = config_dir.join("recent_repos.json");

    let mut repos: Vec<RecentRepo> = if file_path.exists() {
        let content =
            fs::read_to_string(&file_path).map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    repos.retain(|r| r.path != path);

    let name = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    repos.insert(
        0,
        RecentRepo {
            path: path.to_string(),
            name,
            last_opened: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        },
    );

    if repos.len() > 10 {
        repos.truncate(10);
    }

    let content =
        serde_json::to_string_pretty(&repos).map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&file_path, content).map_err(|e| format!("写入配置失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_status(path: String) -> Result<Vec<crate::models::status::FileStatus>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::status::get_status(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn stage_files(path: String, files: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::status::stage_files(&repo, &files)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn unstage_files(path: String, files: Vec<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::status::unstage_files(&repo, &files)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn get_conflicts(path: String) -> Result<Vec<ConflictEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::status::get_conflicts(&repo)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn resolve_conflict(path: String, file: String, resolution: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let repo = git::repo::open_repo(&path)?;
        git::status::resolve_conflict(&repo, &file, &resolution)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))?
}

#[tauri::command]
pub async fn clone_repo(url: String, path: String) -> Result<RepoInfo, String> {
    let (_, info) = tokio::task::spawn_blocking(move || {
        git::repo::clone_repo(&url, &path)
    })
    .await
    .map_err(|e| format!("内部错误: {}", e))??;

    save_repo_path_inner(&info.path)?;
    Ok(info)
}
