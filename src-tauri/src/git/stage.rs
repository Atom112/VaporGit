use std::cell::{Cell, RefCell};
use git2::{ApplyLocation, Diff, DiffOptions, Repository};

/// Stage a specific hunk from the working tree for a given file.
/// `file_path` is relative to the repo root.
/// `hunk_index` is 0-based within the unstaged diff for that file.
pub fn stage_hunk(repo: &Repository, file_path: &str, hunk_index: usize) -> Result<(), String> {
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path).context_lines(3);

    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let current_hunk = Cell::new(0usize);
    let found = Cell::new(false);
    let target_hunk_text = RefCell::new(String::new());
    let target_hunk_header = RefCell::new(String::new());
    let old_path = RefCell::new(String::new());
    let new_path = RefCell::new(String::new());

    diff.foreach(
        &mut |delta, _| {
            old_path.replace(
                delta
                    .old_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            );
            new_path.replace(
                delta
                    .new_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            );
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            if current_hunk.get() == hunk_index {
                target_hunk_header
                    .replace(String::from_utf8_lossy(hunk.header()).to_string());
            }
            current_hunk.set(current_hunk.get() + 1);
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            // current_hunk was already incremented in hunk_cb, so check against hunk_index + 1
            if current_hunk.get() - 1 == hunk_index {
                found.set(true);
                let origin = line.origin();
                let content = String::from_utf8_lossy(line.content());
                target_hunk_text.borrow_mut().push_str(&format!("{}{}", origin, content));
            }
            true
        }),
    )
    .map_err(|e| format!("遍历 diff 失败: {}", e))?;

    if !found.get() {
        return Err(format!("未找到 hunk 索引 {}", hunk_index));
    }

    let file_old = {
        let p = old_path.borrow();
        if p.is_empty() { file_path.to_string() } else { p.clone() }
    };
    let file_new = {
        let p = new_path.borrow();
        if p.is_empty() { file_path.to_string() } else { p.clone() }
    };

    let patch_bytes = format!(
        "--- a/{}\n+++ b/{}\n@@ {}@@{}",
        file_old,
        file_new,
        target_hunk_header.borrow(),
        if target_hunk_text.borrow().ends_with('\n') { "" } else { "\n" }
    );
    let patch_bytes = format!("{}{}", patch_bytes, target_hunk_text.borrow());

    let patch_diff = Diff::from_buffer(patch_bytes.as_bytes())
        .map_err(|e| format!("无法解析 patch: {}", e))?;

    repo.apply(&patch_diff, ApplyLocation::Index, None)
        .map_err(|e| format!("应用 hunk 到暂存区失败: {}", e))?;

    Ok(())
}

/// Stage a single line within a hunk.
pub fn stage_line(
    repo: &Repository,
    file_path: &str,
    hunk_index: usize,
    line_index: usize,
) -> Result<(), String> {
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let current_hunk = Cell::new(0usize);
    let current_line = Cell::new(0usize);
    let in_target_hunk = Cell::new(false);
    let found = Cell::new(false);
    let target_line_text = RefCell::new(String::new());
    let target_hunk_header = RefCell::new(String::new());
    let old_path = RefCell::new(String::new());
    let new_path = RefCell::new(String::new());

    diff.foreach(
        &mut |delta, _| {
            old_path.replace(
                delta
                    .old_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            );
            new_path.replace(
                delta
                    .new_file()
                    .path()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            );
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            in_target_hunk.set(current_hunk.get() == hunk_index);
            if in_target_hunk.get() {
                target_hunk_header
                    .replace(String::from_utf8_lossy(hunk.header()).to_string());
            }
            current_line.set(0);
            current_hunk.set(current_hunk.get() + 1);
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            if in_target_hunk.get() {
                if current_line.get() == line_index && line.origin() != ' ' {
                    found.set(true);
                    let origin = line.origin();
                    let content = String::from_utf8_lossy(line.content());
                    target_line_text.replace(format!("{}{}", origin, content));
                }
                current_line.set(current_line.get() + 1);
            }
            true
        }),
    )
    .map_err(|e| format!("遍历 diff 失败: {}", e))?;

    if !found.get() {
        return Err(format!(
            "未找到行索引 {} (hunk {} 中只有上下文行，无法单独暂存)",
            line_index, hunk_index
        ));
    }

    let file_old = {
        let p = old_path.borrow();
        if p.is_empty() { file_path.to_string() } else { p.clone() }
    };
    let file_new = {
        let p = new_path.borrow();
        if p.is_empty() { file_path.to_string() } else { p.clone() }
    };

    let patch_bytes = format!(
        "--- a/{}\n+++ b/{}\n@@ {}@@\n{}",
        file_old, file_new, target_hunk_header.borrow(), target_line_text.borrow()
    );

    let patch_diff = Diff::from_buffer(patch_bytes.as_bytes())
        .map_err(|e| format!("无法解析 patch: {}", e))?;

    repo.apply(&patch_diff, ApplyLocation::Index, None)
        .map_err(|e| format!("应用行到暂存区失败: {}", e))?;

    Ok(())
}
