mod common;

use std::fs;

use app_lib::git::{commit, status};

#[test]
fn commit_creates_history_entry_and_detail() {
    let test_repo = common::init_repo();
    common::write_file(test_repo.path(), "src/main.txt", "content\n");
    status::stage_files(&test_repo.repo, &["src/main.txt".to_string()]).expect("stage file");

    let info = commit::commit(&test_repo.repo, "add main file").expect("commit");

    assert_eq!(info.message, "add main file");
    assert_eq!(info.parent_ids.len(), 1);

    let history = commit::get_commit_history(&test_repo.repo, 0, 10).expect("history");
    assert_eq!(history.first().map(|entry| entry.message.as_str()), Some("add main file"));

    let detail = commit::get_commit_detail(&test_repo.repo, &info.id).expect("detail");
    assert!(detail
        .changed_files
        .iter()
        .any(|file| file.file_path == "src/main.txt" && file.status == "added"));
}

#[test]
fn amend_commit_replaces_head_message() {
    let test_repo = common::init_repo();
    common::write_file(test_repo.path(), "notes.txt", "notes\n");
    status::stage_files(&test_repo.repo, &["notes.txt".to_string()]).expect("stage file");
    commit::commit(&test_repo.repo, "add notes").expect("commit");

    let amended = commit::amend_commit(&test_repo.repo, "add useful notes").expect("amend");

    assert_eq!(amended.message, "add useful notes");
    let history = commit::get_commit_history(&test_repo.repo, 0, 1).expect("history");
    assert_eq!(history[0].message, "add useful notes");
}

#[test]
fn undo_and_redo_restore_last_commit_content() {
    let test_repo = common::init_repo();
    common::write_file(test_repo.path(), "redo.txt", "redo me\n");
    status::stage_files(&test_repo.repo, &["redo.txt".to_string()]).expect("stage file");
    commit::commit(&test_repo.repo, "add redo file").expect("commit");

    let undo_message = commit::undo(&test_repo.repo).expect("undo");
    assert_eq!(undo_message.lines().next(), Some("add redo file"));

    let history = commit::get_commit_history(&test_repo.repo, 0, 1).expect("history after undo");
    assert_eq!(history[0].message, "initial");

    let redo_message = commit::redo(&test_repo.repo).expect("redo");
    assert_eq!(redo_message.lines().next(), Some("add redo file"));
    assert_eq!(
        fs::read_to_string(test_repo.path().join("redo.txt")).expect("redo content"),
        "redo me\n"
    );

    let history = commit::get_commit_history(&test_repo.repo, 0, 1).expect("history after redo");
    assert_eq!(history[0].message, "add redo file");
}
