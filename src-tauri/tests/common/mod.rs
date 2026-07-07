use git2::{Oid, Repository, Signature};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

pub struct TestRepo {
    pub _temp: TempDir,
    pub repo: Repository,
}

impl TestRepo {
    #[allow(dead_code)]
    pub fn path(&self) -> &Path {
        self._temp.path()
    }

    #[allow(dead_code)]
    pub fn head_branch(&self) -> String {
        self.repo
            .head()
            .expect("head")
            .shorthand()
            .expect("head shorthand")
            .to_string()
    }
}

pub fn init_repo() -> TestRepo {
    let temp = tempfile::tempdir().expect("create tempdir");
    let repo = Repository::init(temp.path()).expect("init repo");
    {
        let mut config = repo.config().expect("config");
        config.set_str("user.name", "VaporGit Test").expect("user.name");
        config
            .set_str("user.email", "vaporgit-test@example.com")
            .expect("user.email");
    }
    write_and_commit(&repo, temp.path(), "README.md", "hello\n", "initial");
    TestRepo { _temp: temp, repo }
}

pub fn write_file(root: &Path, relative_path: &str, content: &str) {
    let path = root.join(relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create parent dirs");
    }
    fs::write(path, content).expect("write file");
}

pub fn write_and_commit(
    repo: &Repository,
    root: &Path,
    relative_path: &str,
    content: &str,
    message: &str,
) -> Oid {
    write_file(root, relative_path, content);
    commit_all(repo, message)
}

pub fn commit_all(repo: &Repository, message: &str) -> Oid {
    let mut index = repo.index().expect("index");
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .expect("add all");
    index.write().expect("write index");
    let tree_id = index.write_tree().expect("write tree");
    let tree = repo.find_tree(tree_id).expect("find tree");
    let signature = Signature::now("VaporGit Test", "vaporgit-test@example.com").expect("signature");
    let parents = repo
        .head()
        .ok()
        .and_then(|head| head.peel_to_commit().ok())
        .into_iter()
        .collect::<Vec<_>>();
    let parent_refs = parents.iter().collect::<Vec<_>>();
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        parent_refs.as_slice(),
    )
    .expect("commit")
}
