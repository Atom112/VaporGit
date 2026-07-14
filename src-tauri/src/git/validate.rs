use crate::git_err;

/// Validate git ref names (branches, tags) against git's ref format rules.
/// See git-check-ref-format(1) for the full rules.
pub fn validate_ref_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err(git_err!("VALIDATE_EMPTY_REF_NAME", "Ref name cannot be empty"));
    }
    if name.len() > 255 {
        return Err(git_err!("VALIDATE_REF_NAME_TOO_LONG", "Ref name is too long (max 255 characters)"));
    }
    if name.starts_with('.') {
        return Err(git_err!("VALIDATE_REF_NAME_DOT_PREFIX", "Ref name cannot start with '.'"));
    }
    if name.starts_with('/') || name.ends_with('/') {
        return Err(git_err!("VALIDATE_REF_NAME_SLASH_ENDS", "Ref name cannot start or end with '/'"));
    }
    if name.contains("..") {
        return Err(git_err!("VALIDATE_REF_NAME_DOT_DOT", "Ref name cannot contain '..'"));
    }
    if name.contains(' ') {
        return Err(git_err!("VALIDATE_REF_NAME_SPACE", "Ref name cannot contain spaces"));
    }
    if name.contains('\\') || name.contains('^') || name.contains('~') || name.contains(':')
        || name.contains('?') || name.contains('*') || name.contains('[')
        || name.contains('@') || name.contains('\0')
    {
        return Err(git_err!("VALIDATE_REF_NAME_SPECIAL_CHARS", "Ref name contains invalid special characters"));
    }
    if name.contains("//") {
        return Err(git_err!("VALIDATE_REF_NAME_DOUBLE_SLASH", "Ref name cannot contain '//'"));
    }
    if name.ends_with(".lock") {
        return Err(git_err!("VALIDATE_REF_NAME_LOCK_SUFFIX", "Ref name cannot end with '.lock'"));
    }
    // Check each component
    for component in name.split('/') {
        if component.is_empty() {
            return Err(git_err!("VALIDATE_REF_NAME_EMPTY_COMPONENT", "Ref name contains an empty component (consecutive slashes)"));
        }
        if component.starts_with('.') {
            return Err(git_err!("VALIDATE_REF_NAME_COMPONENT_DOT", "A ref name component cannot start with '.'"));
        }
    }
    Ok(())
}

/// Validate a commit message is not empty and within reasonable length.
#[allow(dead_code)]
pub fn validate_commit_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err(git_err!("VALIDATE_EMPTY_COMMIT_MSG", "Commit message cannot be empty"));
    }
    if message.len() > 10000 {
        return Err(git_err!("VALIDATE_COMMIT_MSG_TOO_LONG", "Commit message is too long (max 10000 characters)"));
    }
    Ok(())
}

/// Validate a file path is a safe relative path (not absolute, no parent dir references).
pub fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err(git_err!("VALIDATE_EMPTY_PATH", "Path cannot be empty"));
    }
    if std::path::Path::new(path).is_absolute() {
        return Err(git_err!("VALIDATE_ABSOLUTE_PATH", "Path '{}' is absolute, use a relative path", path));
    }
    if path.contains("..") {
        return Err(git_err!("VALIDATE_PARENT_DIR", "Path '{}' contains '..', operation not allowed", path));
    }
    if path.contains('\0') {
        return Err(git_err!("VALIDATE_NULL_BYTE", "Path contains null byte, operation not allowed"));
    }
    // Windows DOS reserved device names break filesystem operations
    if path_has_dos_device_name(path) {
        return Err(git_err!("VALIDATE_DOS_DEVICE_NAME", "Path '{}' is a Windows reserved device name, operation not supported", path));
    }
    Ok(())
}

/// Windows DOS reserved device names (case-insensitive).
/// Files named like these cause Windows APIs to redirect to device drivers,
/// breaking normal file operations (canonicalize, exists, metadata, stat).
/// These are: CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9.
/// See https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
#[cfg(target_os = "windows")]
const DOS_DEVICE_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Check if a single path component (no directory separators) is a Windows
/// DOS reserved device name. The check is case-insensitive and matches both
/// bare names and names with any extension (e.g. "NUL", "nul.txt", "CON").
#[cfg(target_os = "windows")]
pub fn is_dos_device_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name);
    let upper = stem.to_uppercase();
    DOS_DEVICE_NAMES.contains(&upper.as_str())
}

/// Check if a path contains any component that is a Windows DOS reserved
/// device name. On non-Windows, always returns false.
#[cfg(not(target_os = "windows"))]
pub fn is_dos_device_name(_name: &str) -> bool {
    false
}

/// Check if any component of a path is a DOS reserved device name.
pub fn path_has_dos_device_name(path: &str) -> bool {
    std::path::Path::new(path)
        .components()
        .any(|c| {
            if let std::path::Component::Normal(os_str) = c {
                os_str.to_str().map_or(false, |s| is_dos_device_name(s))
            } else {
                false
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_relative_path_ok() {
        assert!(validate_relative_path("src/main.rs").is_ok());
        assert!(validate_relative_path("a/b/c/d.txt").is_ok());
        assert!(validate_relative_path("file with spaces.js").is_ok());
        assert!(validate_relative_path("normal_file.ts").is_ok());
    }

    #[test]
    fn test_relative_path_empty() {
        assert!(validate_relative_path("").is_err());
    }

    #[test]
    fn test_relative_path_absolute() {
        // Windows absolute path (also a valid path pattern on Unix, but unlikely to collide)
        assert!(validate_relative_path("C:\\Windows\\system32").is_err());
        // UNC path (Windows) — also handled by Path::is_absolute
        assert!(validate_relative_path("\\\\server\\share").is_err());
    }

    #[test]
    fn test_relative_path_parent_dir() {
        assert!(validate_relative_path("../outside").is_err());
        assert!(validate_relative_path("a/../../b").is_err());
    }


    #[test]
    fn test_dos_device_name_detection() {
        assert!(is_dos_device_name("NUL"));
        assert!(is_dos_device_name("nul"));
        assert!(is_dos_device_name("NuL"));
        assert!(is_dos_device_name("CON"));
        assert!(is_dos_device_name("PRN"));
        assert!(is_dos_device_name("AUX"));
        assert!(is_dos_device_name("COM1"));
        assert!(is_dos_device_name("LPT9"));
        assert!(!is_dos_device_name("README.md"));
        assert!(!is_dos_device_name("null"));
    }

    #[test]
    fn test_dos_device_name_with_extension() {
        assert!(is_dos_device_name("nul.txt"));
        assert!(is_dos_device_name("NUL.cs"));
        assert!(is_dos_device_name("CON.py"));
    }

    #[test]
    fn test_path_has_dos_device_name() {
        assert!(path_has_dos_device_name("nul"));
        assert!(path_has_dos_device_name("subdir/nul"));
        assert!(path_has_dos_device_name("a/b/CON"));
        assert!(!path_has_dos_device_name("a/b/normal.txt"));
        assert!(!path_has_dos_device_name("README.md"));
    }

    #[test]
    fn test_validate_relative_path_rejects_dos_names() {
        assert!(validate_relative_path("nul").is_err());
        assert!(validate_relative_path("subdir/NUL").is_err());
        assert!(validate_relative_path("a/CON.txt").is_err());
        assert!(validate_relative_path("normal_file.rs").is_ok());
    }
    #[test]
    fn test_relative_path_null_byte() {
        assert!(validate_relative_path("bad\0file").is_err());
    }
}
