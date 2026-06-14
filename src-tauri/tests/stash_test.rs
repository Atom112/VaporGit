mod common;

use app_lib::git;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {}

#[test]
fn stash_save_list_and_pop_round_trip_tracked_changes() {
    let mut test_repo = common::init_repo();
    common::write_file(test_repo.path(), "README.md", "work in progress\n");

    git::stash::stash_save(&mut test_repo.repo, Some("save tracked change")).expect("stash save");

    let stashes = git::stash::stash_list(&mut test_repo.repo).expect("stash list");
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("save tracked change"));
    assert_eq!(
        std::fs::read_to_string(test_repo.path().join("README.md")).expect("read readme"),
        "hello\n"
    );

    git::stash::stash_pop(&mut test_repo.repo, 0).expect("stash pop");

    assert_eq!(
        std::fs::read_to_string(test_repo.path().join("README.md")).expect("read readme"),
        "work in progress\n"
    );
    assert!(git::stash::stash_list(&mut test_repo.repo)
        .expect("stash list after pop")
        .is_empty());
}

#[test]
fn stash_apply_keeps_stash_available_until_drop() {
    let mut test_repo = common::init_repo();
    common::write_file(test_repo.path(), "README.md", "apply me\n");

    git::stash::stash_save(&mut test_repo.repo, Some("apply tracked change")).expect("stash save");
    git::stash::stash_apply(&mut test_repo.repo, 0).expect("stash apply");

    assert_eq!(
        std::fs::read_to_string(test_repo.path().join("README.md")).expect("read readme"),
        "apply me\n"
    );
    assert_eq!(git::stash::stash_list(&mut test_repo.repo).expect("stash list").len(), 1);

    git::stash::stash_drop(&mut test_repo.repo, 0).expect("stash drop");
    assert!(git::stash::stash_list(&mut test_repo.repo)
        .expect("stash list after drop")
        .is_empty());
}
