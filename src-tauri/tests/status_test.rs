mod common;

use std::fs;

use app_lib::git::status;
use app_lib::models::status::StatusKind;

#[test]
fn stage_and_unstage_untracked_file() {
    let test_repo = common::init_repo();
    common::write_file(test_repo.path(), "notes.txt", "draft\n");

    let statuses = status::get_status(&test_repo.repo).expect("status");
    assert!(statuses
        .iter()
        .any(|file| file.path == "notes.txt" && file.status == StatusKind::WtNew && !file.staged));

    let statuses = status::stage_files(&test_repo.repo, &["notes.txt".to_string()])
        .expect("stage file");
    assert!(statuses
        .iter()
        .any(|file| file.path == "notes.txt" && file.status == StatusKind::IndexNew && file.staged));

    let statuses = status::unstage_files(&test_repo.repo, &["notes.txt".to_string()])
        .expect("unstage file");
    assert!(statuses
        .iter()
        .any(|file| file.path == "notes.txt" && file.status == StatusKind::WtNew && !file.staged));
}

#[test]
fn discard_files_restores_tracked_changes_and_removes_untracked_file() {
    let test_repo = common::init_repo();
    fs::write(test_repo.path().join("README.md"), "changed\n").expect("modify readme");
    common::write_file(test_repo.path(), "scratch.txt", "temporary\n");

    let statuses = status::discard_files(
        &test_repo.repo,
        &["README.md".to_string(), "scratch.txt".to_string()],
    )
    .expect("discard files");

    assert_eq!(
        fs::read_to_string(test_repo.path().join("README.md")).expect("read readme"),
        "hello\n"
    );
    assert!(!test_repo.path().join("scratch.txt").exists());
    assert!(statuses.is_empty());
}

#[test]
fn stage_files_rejects_parent_directory_paths() {
    let test_repo = common::init_repo();

    let err = status::stage_files(&test_repo.repo, &["../outside.txt".to_string()])
        .expect_err("parent directory traversal should fail");

    assert!(err.contains(".."));
}
