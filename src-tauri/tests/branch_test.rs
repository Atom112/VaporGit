mod common;

use app_lib::git;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {}

#[test]
fn branch_create_checkout_compare_and_delete() {
    let test_repo = common::init_repo();
    let default_branch = test_repo.head_branch();

    git::branch::create_branch(&test_repo.repo, "feature/test", None).expect("create branch");
    git::branch::checkout_branch(&test_repo.repo, "feature/test").expect("checkout feature");
    assert_eq!(test_repo.head_branch(), "feature/test");

    common::write_and_commit(
        &test_repo.repo,
        test_repo.path(),
        "feature.txt",
        "feature content\n",
        "add feature file",
    );

    git::branch::checkout_branch(&test_repo.repo, &default_branch).expect("checkout default");
    let summary = git::branch::compare_branches(&test_repo.repo, &default_branch, "feature/test")
        .expect("compare branches");

    assert_eq!(summary.base_branch, default_branch);
    assert_eq!(summary.target_branch, "feature/test");
    assert!(summary.files.iter().any(|file| file.file_path == "feature.txt"));

    git::branch::delete_branch(&test_repo.repo, "feature/test").expect("delete feature");
    let branches = git::branch::get_branch_list(&test_repo.repo).expect("branch list");
    assert!(!branches.iter().any(|branch| branch.name == "feature/test"));
}

#[test]
fn branch_delete_rejects_current_branch() {
    let test_repo = common::init_repo();
    let current = test_repo.head_branch();

    let err = git::branch::delete_branch(&test_repo.repo, &current).expect_err("delete current");
    assert!(err.contains(&current));
}
