/// Create a formatted error string with an error code prefix.
///
/// The generated string has the format `[ERROR_CODE] Human-readable message`
/// so the frontend `describeError()` can extract the code for i18n lookup.
///
/// # Examples
///
/// ```ignore
/// // Static message
/// git_err!("VALIDATE_EMPTY", "Value cannot be empty")
///
/// // With format args (e.g. wrapping a git2 error)
/// git_err!("COMMIT_FAILED", "Commit failed: {}", git2_err)
/// ```
#[macro_export]
macro_rules! git_err {
    ($code:expr, $fmt:literal $(, $arg:expr)* $(,)?) => {
        format!("[{}] {}", $code, format!($fmt $(, $arg)*))
    };
}
