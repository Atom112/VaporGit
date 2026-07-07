use git2::{Repository, Signature};
use std::fs;
use tempfile::TempDir;

#[cfg(target_os = "windows")]
#[link(name = "Advapi32")]
extern "system" {}

fn init_repo() -> (TempDir, Repository) {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo = Repository::init(temp.path()).expect("init repo");
    fs::write(temp.path().join("README.md"), "hello\n").expect("write readme");
    let mut index = repo.index().expect("repo index");
    index.add_path(std::path::Path::new("README.md")).expect("add readme");
    let tree_id = index.write_tree().expect("write tree");
    {
        let tree = repo.find_tree(tree_id).expect("find tree");
        let sig = Signature::now("Test", "test@example.com").expect("signature");
        repo.commit(Some("HEAD"), &sig, &sig, "initial", &tree, &[])
            .expect("commit");
    }
    (temp, repo)
}

#[test]
fn repository_initializes_for_integration_tests() {
    let (_temp, repo) = init_repo();
    assert!(repo.head().is_ok());
}
