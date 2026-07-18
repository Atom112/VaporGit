use crate::git_err;
use git2::Repository;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// Create a demo repository for the tutorial walkthrough.
///
/// Returns the path to the created repository.
#[tauri::command]
pub async fn create_demo_repo() -> Result<String, String> {
    tokio::task::spawn_blocking(create_demo_repo_sync)
        .await
        .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}

fn create_demo_repo_sync() -> Result<String, String> {
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let repo_path = std::env::temp_dir()
        .join(format!("VaporGit_Tutorial_{}", suffix));

    fs::create_dir_all(&repo_path).map_err(|e| git_err!("TUTORIAL_CREATE_DIR_FAILED", "Failed to create temp directory: {}", e))?;

    // Create src directory
    let src_dir = repo_path.join("src");
    fs::create_dir_all(&src_dir).map_err(|e| git_err!("TUTORIAL_CREATE_SRC_DIR_FAILED", "Failed to create src directory: {}", e))?;

    // Initialize git repo
    let repo = Repository::init(&repo_path)
        .map_err(|e| git_err!("TUTORIAL_INIT_FAILED", "Failed to initialize repository: {}", e))?;

    // Get the index / staging area
    let mut index = repo.index().map_err(|e| git_err!("TUTORIAL_GET_INDEX_FAILED", "Failed to get index: {}", e))?;

    let sig = git2::Signature::now("Tutorial", "tutorial@vaporgit.app")
        .map_err(|e| git_err!("TUTORIAL_CREATE_SIGNATURE_FAILED", "Failed to create signature: {}", e))?;

    // ── Commit 1: Initial commit ──
    let readme_content = b"# VaporGit Tutorial\n\nThis is a demo repository for the VaporGit tutorial.\n";
    let main_content = b"#!/usr/bin/env python3\n\nprint('Hello, World!')\n";

    fs::write(repo_path.join("README.md"), readme_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_README_FAILED", "Failed to write README: {}", e))?;
    fs::write(src_dir.join("main.py"), main_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_MAIN_FAILED", "Failed to write main.py: {}", e))?;

    index.add_path(Path::new("README.md"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_README_FAILED", "Failed to stage README: {}", e))?;
    index.add_path(Path::new("src/main.py"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_MAIN_FAILED", "Failed to stage main.py: {}", e))?;

    let tree_id = index.write_tree().map_err(|e| git_err!("TUTORIAL_WRITE_TREE_FAILED", "Failed to write tree: {}", e))?;
    let tree = repo.find_tree(tree_id).map_err(|e| git_err!("TUTORIAL_FIND_TREE_FAILED", "Failed to find tree: {}", e))?;

    repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[])
        .map_err(|e| git_err!("TUTORIAL_INITIAL_COMMIT_FAILED", "Initial commit failed: {}", e))?;

    // ── Commit 2: Add feature and utility module ──
    let utils_content = b"#!/usr/bin/env python3\n\ndef greet(name):\n    return f'Hello, {name}!'\n\ndef add(a, b):\n    return a + b\n";
    let updated_main = b"#!/usr/bin/env python3\n\nfrom utils import greet\n\ndef main():\n    name = input('Enter your name: ')\n    print(greet(name))\n\nif __name__ == '__main__':\n    main()\n";

    fs::write(src_dir.join("utils.py"), utils_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_UTILS_FAILED", "Failed to write utils.py: {}", e))?;
    fs::write(src_dir.join("main.py"), updated_main)
        .map_err(|e| git_err!("TUTORIAL_UPDATE_MAIN_FAILED", "Failed to update main.py: {}", e))?;

    index = repo.index().map_err(|e| git_err!("TUTORIAL_GET_INDEX_FAILED", "Failed to get index: {}", e))?;
    index.add_path(Path::new("src/utils.py"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_UTILS_FAILED", "Failed to stage utils.py: {}", e))?;
    index.add_path(Path::new("src/main.py"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_MAIN_FAILED", "Failed to stage main.py: {}", e))?;

    let tree_id = index.write_tree().map_err(|e| git_err!("TUTORIAL_WRITE_TREE_FAILED", "Failed to write tree: {}", e))?;
    let tree = repo.find_tree(tree_id).map_err(|e| git_err!("TUTORIAL_FIND_TREE_FAILED", "Failed to find tree: {}", e))?;
    let parent = repo.head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok());

    let parent_refs: Vec<&git2::Commit<'_>> = parent.iter().collect();
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Add utility module and update main",
        &tree,
        &parent_refs,
    )
    .map_err(|e| git_err!("TUTORIAL_SECOND_COMMIT_FAILED", "Second commit failed: {}", e))?;

    // ── Commit 3: Add a new feature file and TODO ──
    let new_feature_content = b"#!/usr/bin/env python3\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\ndef is_palindrome(s):\n    return s == s[::-1]\n";
    let todo_content = b"# TODO\n\n- [x] Set up project structure\n- [x] Implement basic greeting\n- [ ] Add more utility functions\n- [ ] Write unit tests\n- [ ] Add CI/CD pipeline\n";

    fs::write(src_dir.join("new_feature.py"), new_feature_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_FEATURE_FAILED", "Failed to write new_feature.py: {}", e))?;
    fs::write(repo_path.join("TODO.md"), todo_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_TODO_FAILED", "Failed to write TODO.md: {}", e))?;

    index = repo.index().map_err(|e| git_err!("TUTORIAL_GET_INDEX_FAILED", "Failed to get index: {}", e))?;
    index.add_path(Path::new("src/new_feature.py"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_FEATURE_FAILED", "Failed to stage new_feature.py: {}", e))?;
    index.add_path(Path::new("TODO.md"))
        .map_err(|e| git_err!("TUTORIAL_STAGE_TODO_FAILED", "Failed to stage TODO.md: {}", e))?;

    let tree_id = index.write_tree().map_err(|e| git_err!("TUTORIAL_WRITE_TREE_FAILED", "Failed to write tree: {}", e))?;
    let tree = repo.find_tree(tree_id).map_err(|e| git_err!("TUTORIAL_FIND_TREE_FAILED", "Failed to find tree: {}", e))?;
    let parent = repo.head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok());

    let parent_refs: Vec<&git2::Commit<'_>> = parent.iter().collect();
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "Add new feature module and TODO list",
        &tree,
        &parent_refs,
    )
    .map_err(|e| git_err!("TUTORIAL_THIRD_COMMIT_FAILED", "Third commit failed: {}", e))?;

    // Leave some unstaged changes for the user to see
    let unstaged_content = b"#!/usr/bin/env python3\n\n# This file has unstaged changes\n\nprint('Welcome to VaporGit!')\n";
    fs::write(src_dir.join("main.py"), unstaged_content)
        .map_err(|e| git_err!("TUTORIAL_WRITE_UNSTAGED_FAILED", "Failed to write unstaged changes: {}", e))?;

    Ok(repo_path.to_string_lossy().to_string())
}

/// Delete a directory and all its contents.
#[tauri::command]
pub async fn delete_dir(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let target = std::path::PathBuf::from(&path);
        let canonical_target = target
            .canonicalize()
            .map_err(|e| git_err!("TUTORIAL_CANONICALIZE_FAILED", "Failed to canonicalize directory: {}", e))?;
        let canonical_temp = std::env::temp_dir()
            .canonicalize()
            .map_err(|e| git_err!("TUTORIAL_CANONICALIZE_TEMP_FAILED", "Failed to canonicalize temp directory: {}", e))?;
        let file_name = canonical_target
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();

        if !canonical_target.starts_with(&canonical_temp)
            || !file_name.starts_with("VaporGit_Tutorial_")
        {
            return Err(git_err!("TUTORIAL_DELETE_NOT_ALLOWED", "Only VaporGit tutorial repositories can be deleted"));
        }

        fs::remove_dir_all(&canonical_target).map_err(|e| git_err!("TUTORIAL_DELETE_DIR_FAILED", "Failed to delete directory: {}", e))
    })
    .await
    .map_err(|e| git_err!("INTERNAL_SPAWN_BLOCKING", "Internal error: {}", e))?
}
