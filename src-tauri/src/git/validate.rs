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
    Ok(())
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
    fn test_relative_path_null_byte() {
        assert!(validate_relative_path("bad\0file").is_err());
    }
}
