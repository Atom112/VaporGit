mod common;

use std::fs;

use app_lib::git::repo;

#[test]
fn init_repo_creates_initial_readme_commit() {
    let temp = tempfile::tempdir().expect("tempdir");
    let repo_path = temp.path().join("created");

    let info = repo::init_repo(repo_path.to_str().expect("utf8 path"), true).expect("init repo");

    assert_eq!(info.path, repo_path.to_string_lossy());
    assert_eq!(info.head_branch.as_deref(), Some("master"));
    assert!(info.head_commit.is_some());
    assert!(!info.is_bare);
    assert!(!info.is_detached);
    assert_eq!(info.state_summary, "Clean");
    assert!(repo_path.join("README.md").exists());
}

#[test]
fn init_repo_rejects_non_empty_directory() {
    let temp = tempfile::tempdir().expect("tempdir");
    fs::write(temp.path().join("existing.txt"), "already here").expect("write marker");

    let err = repo::init_repo(temp.path().to_str().expect("utf8 path"), false)
        .expect_err("non-empty directory should fail");

    assert!(err.contains("不为空") || err.contains("not empty"));
}

#[test]
fn get_repo_info_reports_existing_repository_state() {
    let test_repo = common::init_repo();

    let info = repo::get_repo_info(&test_repo.repo, test_repo.path().to_str().expect("utf8 path"))
        .expect("repo info");

    assert_eq!(info.head_branch.as_deref(), Some("master"));
    assert!(info.head_commit.is_some());
    assert_eq!(info.state_summary, "Clean");
}

#[test]
fn check_submodules_parses_gitmodules_fallback() {
    let test_repo = common::init_repo();
    fs::write(
        test_repo.path().join(".gitmodules"),
        "[submodule \"vendor/lib\"]\n\tpath = vendor/lib\n\turl = https://example.com/lib.git\n",
    )
    .expect("write .gitmodules");

    let submodules = repo::check_submodules(&test_repo.repo).expect("submodules");

    assert_eq!(submodules, vec!["vendor/lib".to_string()]);
}
