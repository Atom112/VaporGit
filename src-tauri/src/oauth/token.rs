use keyring::Entry;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

/// Write a file with restricted permissions (owner-only on Unix).
/// Uses 0600 on Unix; standard permissions on Windows (file is in user appdata).
pub(crate) fn write_secure_file(path: &std::path::Path, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("无法写入文件: {}", e))?;
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub struct TokenConfig {
    pub service_name: &'static str,
    pub keyring_user: &'static str,
    pub file_name: &'static str,
}

fn token_dir() -> PathBuf {
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

static MEMORY_TOKENS: OnceLock<Mutex<HashMap<&'static str, Option<String>>>> = OnceLock::new();

fn memory_tokens() -> &'static Mutex<HashMap<&'static str, Option<String>>> {
    MEMORY_TOKENS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub struct TokenStore {
    config: TokenConfig,
}

impl TokenStore {
    pub fn new(config: TokenConfig) -> Self {
        Self { config }
    }

    pub fn save(&self, token: &str) -> Result<(), String> {
        memory_tokens()
            .lock()
            .unwrap()
            .insert(self.config.keyring_user, Some(token.to_string()));

        if let Ok(entry) = Entry::new(self.config.service_name, self.config.keyring_user) {
            let _ = entry.set_password(token);
        }

        let path = token_dir().join(self.config.file_name);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = write_secure_file(&path, token);

        Ok(())
    }

    pub fn load(&self) -> Result<Option<String>, String> {
        if let Some(Some(token)) = memory_tokens()
            .lock()
            .unwrap()
            .get(self.config.keyring_user)
            .cloned()
        {
            return Ok(Some(token));
        }

        if let Ok(entry) = Entry::new(self.config.service_name, self.config.keyring_user) {
            match entry.get_password() {
                Ok(token) => {
                    memory_tokens()
                        .lock()
                        .unwrap()
                        .insert(self.config.keyring_user, Some(token.clone()));
                    return Ok(Some(token));
                }
                Err(keyring::Error::NoEntry) => {}
                Err(e) => {
                    eprintln!("Failed to load token from keychain (non-fatal): {e}");
                }
            }
        }

        let path = token_dir().join(self.config.file_name);
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(token) => {
                    let token = token.trim().to_string();
                    if !token.is_empty() {
                        memory_tokens()
                            .lock()
                            .unwrap()
                            .insert(self.config.keyring_user, Some(token.clone()));
                        return Ok(Some(token));
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read token file (non-fatal): {e}");
                }
            }
        }

        Ok(None)
    }

    pub fn clear(&self) -> Result<(), String> {
        memory_tokens()
            .lock()
            .unwrap()
            .insert(self.config.keyring_user, None);

        if let Ok(entry) = Entry::new(self.config.service_name, self.config.keyring_user) {
            let _ = entry.delete_credential();
        }

        let path = token_dir().join(self.config.file_name);
        if path.exists() {
            let _ = fs::remove_file(&path);
        }

        Ok(())
    }
}
