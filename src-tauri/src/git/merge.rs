use crate::git_err;
use git2::Repository;

/// Merge a branch into the current HEAD with the given strategy.
/// strategy: "merge_commit" | "fast_forward" | "squash"
pub fn merge_branch(
    repo: &Repository,
    branch_name: &str,
    strategy: &str,
) -> Result<String, String> {
    // Resolve the target branch to a commit
    let target_ref = if branch_name.starts_with("refs/") {
        branch_name.to_string()
    } else {
        format!("refs/heads/{}", branch_name)
    };

    let target_commit = repo
        .revparse_single(&target_ref)
        .map_err(|e| git_err!("MERGE_PARSE_BRANCH", "Failed to parse branch '{}': {}", branch_name, e))?
        .peel_to_commit()
        .map_err(|e| git_err!("MERGE_PARSE_BRANCH", "Failed to resolve commit for branch '{}': {}", branch_name, e))?;

    let target_annotated = repo
        .find_annotated_commit(target_commit.id())
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to create annotated commit: {}", e))?;

    let (analysis, _pref) = repo
        .merge_analysis(&[&target_annotated])
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Merge analysis failed: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok("Already up-to-date".to_string());
    }

    match strategy {
        "fast_forward" => {
            if !analysis.is_fast_forward() {
                return Err(git_err!("MERGE_ANALYSIS_FAILED", "Cannot fast-forward merge, please choose another strategy"));
            }
            fast_forward_merge(repo, &target_ref, target_commit.id())
        }
        "squash" => squash_merge(repo, target_commit.id()),
        _ => normal_merge(repo, target_commit.id()),
    }
}

fn fast_forward_merge(repo: &Repository, _target_ref: &str, target_oid: git2::Oid) -> Result<String, String> {
    let head = repo.head().map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to get HEAD: {}", e))?;
    let head_name = head.name().ok_or_else(|| git_err!("MERGE_ANALYSIS_FAILED", "HEAD has no name"))?.to_string();

    let mut reference = repo
        .find_reference(&head_name)
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to find reference: {}", e))?;

    reference
        .set_target(target_oid, "Fast-forward merge")
        .map_err(|e| git_err!("MERGE_FAST_FORWARD_FAILED", "Fast-forward merge failed: {}", e))?;

    repo.set_head(&head_name)
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to set HEAD: {}", e))?;

    repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Checkout failed: {}", e))?;

    Ok("Fast-forward merge complete".to_string())
}

fn normal_merge(repo: &Repository, target_oid: git2::Oid) -> Result<String, String> {
    let target_annotated = repo
        .find_annotated_commit(target_oid)
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to create annotated commit: {}", e))?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    repo.merge(
        &[&target_annotated],
        None,
        Some(&mut checkout_builder),
    )
    .map_err(|e| git_err!("MERGE_FAILED", "Merge failed: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to get index: {}", e))?;

    if index.has_conflicts() {
        let mut conflict_files: Vec<String> = Vec::new();
        if let Ok(conflicts) = index.conflicts() {
            for conflict_result in conflicts {
                if let Ok(conflict) = conflict_result {
                    if let Some(entry) = conflict.ancestor
                        .as_ref()
                        .or_else(|| conflict.our.as_ref())
                        .or_else(|| conflict.their.as_ref())
                    {
                        let path = std::str::from_utf8(&entry.path).unwrap_or("");
                        if !path.is_empty() {
                            conflict_files.push(path.to_string());
                        }
                    }
                }
            }
        }
        conflict_files.sort();
        conflict_files.dedup();
        let files_str = conflict_files.join(", ");
        return Ok(format!("Merge conflict detected, please resolve conflicts before committing. Conflicted files: {}", files_str));
    }

    let tree_oid = index
        .write_tree()
        .map_err(|e| git_err!("MERGE_FAILED", "Failed to write tree: {}", e))?;

    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| git_err!("MERGE_FAILED", "Failed to find tree: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| git_err!("MERGE_FAILED", "Failed to get signature: {}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to get HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to get HEAD commit: {}", e))?;

    let merge_commit = repo
        .find_commit(target_oid)
        .map_err(|e| git_err!("MERGE_COMMIT_FAILED", "Failed to find merge commit: {}", e))?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "Merge branch",
        &tree,
        &[&head_commit, &merge_commit],
    )
    .map_err(|e| git_err!("MERGE_COMMIT_FAILED", "Merge commit failed: {}", e))?;

    repo.cleanup_state()
        .map_err(|e| git_err!("MERGE_STATE_CLEANUP", "Failed to cleanup state: {}", e))?;

    Ok("Merge complete".to_string())
}

fn squash_merge(repo: &Repository, target_oid: git2::Oid) -> Result<String, String> {
    let target_annotated = repo
        .find_annotated_commit(target_oid)
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to create annotated commit: {}", e))?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    let mut merge_opts = git2::MergeOptions::new();

    repo.merge(
        &[&target_annotated],
        Some(&mut merge_opts),
        Some(&mut checkout_builder),
    )
    .map_err(|e| git_err!("MERGE_SQUASH_FAILED", "Squash merge failed: {}", e))?;

    // Mark as squash merge in the index
    let index = repo
        .index()
        .map_err(|e| git_err!("MERGE_ANALYSIS_FAILED", "Failed to get index: {}", e))?;
    if index.has_conflicts() {
        return Ok("Squash merge detected conflicts, please resolve and commit".to_string());
    }
    drop(index);

    // Don't create a merge commit -- let the user commit manually
    repo.cleanup_state()
        .map_err(|e| git_err!("MERGE_STATE_CLEANUP", "Failed to cleanup state: {}", e))?;

    Ok("Squash merge complete, changes staged, please commit".to_string())
}
