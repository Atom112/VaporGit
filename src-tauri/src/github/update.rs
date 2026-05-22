use crate::models::github::GitHubReleaseAsset;
use reqwest::Client;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::Emitter;

/// How often to emit progress events (bytes).
const PROGRESS_INTERVAL: u64 = 256 * 1024; // every 256 KiB

/// Find the best matching asset for the current platform.
///
///  - Windows: prefers `.msi` (supports silent in-place upgrade), falls back to `.exe`
///  - macOS:   `.dmg`
///  - Linux:   runtime-detects package manager → `.deb` (dpkg) or `.rpm` (rpm), then `.AppImage`
pub fn find_matching_asset(assets: &[GitHubReleaseAsset]) -> Option<GitHubReleaseAsset> {
    #[cfg(target_os = "windows")]
    let patterns: &[&str] = &[".msi", ".exe"];
    #[cfg(target_os = "macos")]
    let patterns: &[&str] = &[".dmg"];
    #[cfg(target_os = "linux")]
    let patterns = linux_asset_preference();

    for pattern in patterns {
        if let Some(asset) = assets.iter().find(|a| a.name.ends_with(pattern)) {
            return Some(asset.clone());
        }
    }
    // fallback: first asset
    assets.first().cloned()
}

/// Detect the Linux distribution family at runtime by checking which
/// package manager is installed, then return the matching asset priority.
#[cfg(target_os = "linux")]
fn linux_asset_preference() -> &'static [&'static str] {
    // Check for Debian/Ubuntu family (dpkg is always present)
    if std::path::Path::new("/usr/bin/dpkg").exists() {
        &[".deb", ".AppImage", ".rpm"]
    // Check for Red Hat family (rpm is always present)
    } else if std::path::Path::new("/usr/bin/rpm").exists() {
        &[".rpm", ".AppImage", ".deb"]
    } else {
        &[".AppImage", ".deb", ".rpm"]
    }
}

/// Download destination inside the system temp directory.
pub fn download_destination(asset: &GitHubReleaseAsset) -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(&asset.name);
    path
}

/// Download an asset chunk‑by‑chunk while emitting `download-progress` events.
pub async fn download_update(
    app: &tauri::AppHandle,
    asset: &GitHubReleaseAsset,
) -> Result<String, String> {
    let dest = download_destination(asset);

    // Remove partial download from a previous attempt
    if dest.exists() {
        let _ = fs::remove_file(&dest);
    }

    let client = Client::builder()
        .user_agent("VaporGit/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut response = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|e| format!("Network error starting download: {e}"))?;

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut next_emit = PROGRESS_INTERVAL;

    let mut file = fs::File::create(&dest)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;

    // Stream the response body chunk by chunk
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Download error: {e}"))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write to file: {e}"))?;
        downloaded += chunk.len() as u64;

        if downloaded >= next_emit || downloaded == total {
            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "bytesDownloaded": downloaded,
                    "totalBytes": total,
                }),
            );
            next_emit = downloaded + PROGRESS_INTERVAL;
        }
    }

    file.flush().map_err(|e| format!("Failed to flush file: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Launch the installer and signal the app to exit.
///
/// On Windows this runs `msiexec /i <path> /promptrestart`, which
/// triggers UAC elevation and performs an in‑place MSI upgrade.
pub fn install_update(installer_path: &str, app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("msiexec")
            .arg("/i")
            .arg(installer_path)
            .arg("/promptrestart")
            .spawn()
            .map_err(|e| format!("启动安装程序失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(installer_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        if installer_path.ends_with(".deb") {
            std::process::Command::new("pkexec")
                .arg("dpkg")
                .arg("-i")
                .arg(installer_path)
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {e}"))?;
        } else if installer_path.ends_with(".rpm") {
            std::process::Command::new("pkexec")
                .arg("rpm")
                .arg("-Uvh")
                .arg(installer_path)
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {e}"))?;
        } else {
            // AppImage: make executable and run
            let _ = fs::metadata(installer_path).map(|m| {
                #[allow(unused_imports)]
                use std::os::unix::fs::PermissionsExt;
                let mut perms = m.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(installer_path, perms);
            });
            std::process::Command::new(installer_path)
                .spawn()
                .map_err(|e| format!("Failed to launch installer: {e}"))?;
        }
    }

    // Schedule a clean app exit so the installer can overwrite the binaries
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        app_clone.exit(0);
    });

    Ok(())
}
