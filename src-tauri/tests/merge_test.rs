mod common;

use app_lib::git;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {}

#[test]
fn merge_branch_fast_forward_updates_worktree() {
    let test_repo = common::init_repo();
    let default_branch = test_repo.head_branch();

    git::branch::create_branch(&test_repo.repo, "feature/ff", None).expect("create branch");
    git::branch::checkout_branch(&test_repo.repo, "feature/ff").expect("checkout feature");
    common::write_and_commit(
        &test_repo.repo,
        test_repo.path(),
        "fast-forward.txt",
        "merged content\n",
        "add fast-forward file",
    );

    git::branch::checkout_branch(&test_repo.repo, &default_branch).expect("checkout default");
    let message =
        git::merge::merge_branch(&test_repo.repo, "feature/ff", "fast_forward").expect("merge");

    assert!(!message.is_empty());
    assert_eq!(test_repo.head_branch(), default_branch);
    assert_eq!(
        std::fs::read_to_string(test_repo.path().join("fast-forward.txt")).expect("read file"),
        "merged content\n"
    );
}

#[test]
fn merge_branch_squash_stages_target_changes_without_moving_head() {
    let test_repo = common::init_repo();
    let default_branch = test_repo.head_branch();
    let original_head = test_repo.repo.head().expect("head").target().expect("head target");

    git::branch::create_branch(&test_repo.repo, "feature/squash", None).expect("create branch");
    git::branch::checkout_branch(&test_repo.repo, "feature/squash").expect("checkout feature");
    common::write_and_commit(
        &test_repo.repo,
        test_repo.path(),
        "squash.txt",
        "squashed content\n",
        "add squash file",
    );

    git::branch::checkout_branch(&test_repo.repo, &default_branch).expect("checkout default");
    let message =
        git::merge::merge_branch(&test_repo.repo, "feature/squash", "squash").expect("merge");

    assert!(!message.is_empty());
    assert_eq!(test_repo.repo.head().expect("head").target(), Some(original_head));
    let statuses = git::status::get_status(&test_repo.repo).expect("status");
    assert!(statuses.iter().any(|file| file.path == "squash.txt" && file.staged));
}
