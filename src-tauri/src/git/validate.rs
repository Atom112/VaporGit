/// Validate git ref names (branches, tags) against git's ref format rules.
/// See git-check-ref-format(1) for the full rules.
pub fn validate_ref_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("引用名称不能为空".to_string());
    }
    if name.len() > 255 {
        return Err("引用名称过长（最长 255 个字符）".to_string());
    }
    if name.starts_with('.') {
        return Err("引用名称不能以点号开头".to_string());
    }
    if name.starts_with('/') || name.ends_with('/') {
        return Err("引用名称不能以斜杠开头或结尾".to_string());
    }
    if name.contains("..") {
        return Err("引用名称不能包含连续的句点 '..'".to_string());
    }
    if name.contains(' ') {
        return Err("引用名称不能包含空格".to_string());
    }
    if name.contains('\\') || name.contains('^') || name.contains('~') || name.contains(':')
        || name.contains('?') || name.contains('*') || name.contains('[')
        || name.contains('@') || name.contains('\0')
    {
        return Err("引用名称包含不允许的特殊字符".to_string());
    }
    if name.contains("//") {
        return Err("引用名称不能包含连续的斜杠 '//'".to_string());
    }
    if name.ends_with(".lock") {
        return Err("引用名称不能以 '.lock' 结尾".to_string());
    }
    // Check each component
    for component in name.split('/') {
        if component.is_empty() {
            return Err("引用名称包含空的组件（连续的斜杠）".to_string());
        }
        if component.starts_with('.') {
            return Err("引用名称的组件不能以点号开头".to_string());
        }
    }
    Ok(())
}

/// Validate a commit message is not empty and within reasonable length.
#[allow(dead_code)]
pub fn validate_commit_message(message: &str) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("提交信息不能为空".to_string());
    }
    if message.len() > 10000 {
        return Err("提交信息过长（最长 10000 个字符）".to_string());
    }
    Ok(())
}

/// Validate a file path is not absolute and doesn't contain parent dir references.
#[allow(dead_code)]
pub fn validate_relative_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("路径不能为空".to_string());
    }
    if std::path::Path::new(path).is_absolute() {
        return Err("路径不能是绝对路径".to_string());
    }
    if path.contains("..") {
        return Err("路径不能包含 '..'".to_string());
    }
    if path.contains('\0') {
        return Err("路径不能包含空字符".to_string());
    }
    Ok(())
}
