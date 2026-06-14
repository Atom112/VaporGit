mod common;

use app_lib::git;
use git2::Repository;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {}

#[test]
fn remote_add_set_and_delete_updates_configured_remotes() {
    let test_repo = common::init_repo();

    git::remote::add_remote(&test_repo.repo, "origin", "https://example.com/one.git")
        .expect("add remote");
    let remotes = git::remote::get_remotes(&test_repo.repo).expect("list remotes");
    assert!(remotes
        .iter()
        .any(|remote| remote.name == "origin" && remote.url == "https://example.com/one.git"));

    git::remote::set_remote_url(&test_repo.repo, "origin", "https://example.com/two.git")
        .expect("set remote url");
    let remotes = git::remote::get_remotes(&test_repo.repo).expect("list remotes");
    assert!(remotes
        .iter()
        .any(|remote| remote.name == "origin" && remote.url == "https://example.com/two.git"));

    git::remote::delete_remote(&test_repo.repo, "origin").expect("delete remote");
    assert!(git::remote::get_remotes(&test_repo.repo)
        .expect("list remotes")
        .is_empty());
}

#[test]
fn remote_push_and_fetch_round_trip_with_local_bare_repo() {
    let source = common::init_repo();
    let bare_dir = tempfile::tempdir().expect("bare tempdir");
    let bare_repo = Repository::init_bare(bare_dir.path()).expect("init bare repo");
    let remote_url = bare_dir.path().to_string_lossy().to_string();
    let branch = source.head_branch();

    git::remote::add_remote(&source.repo, "origin", &remote_url).expect("add origin");
    git::remote::push(&source.repo, Some("origin"), Some(&branch)).expect("push branch");
    assert!(bare_repo
        .find_reference(&format!("refs/heads/{branch}"))
        .is_ok());

    let consumer_dir = tempfile::tempdir().expect("consumer tempdir");
    let consumer = Repository::init(consumer_dir.path()).expect("init consumer repo");
    git::remote::add_remote(&consumer, "origin", &remote_url).expect("add origin to consumer");
    git::remote::fetch(&consumer, Some("origin")).expect("fetch branch");

    assert!(consumer
        .find_reference(&format!("refs/remotes/origin/{branch}"))
        .is_ok());
}
