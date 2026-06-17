use git2::{Repository, StashFlags};
use crate::git_err;
use crate::models::stash::StashInfo;

pub fn stash_save(repo: &mut Repository, message: Option<&str>) -> Result<(), String> {
    let signature = repo
        .signature()
        .map_err(|e| git_err!("STASH_SIGNATURE_FAILED", "Failed to get signature: {}", e))?;

    let msg = message.unwrap_or("WIP");

    repo.stash_save(&signature, msg, Some(StashFlags::DEFAULT))
        .map_err(|e| {
            if e.code() == git2::ErrorCode::NotFound {
                git_err!("STASH_EMPTY", "No changes to save")
            } else {
                git_err!("STASH_SAVE_FAILED", "Stash save failed: {}", e)
            }
        })?;

    Ok(())
}

pub fn stash_list(repo: &mut Repository) -> Result<Vec<StashInfo>, String> {
    let mut stashes: Vec<StashInfo> = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stashes.push(StashInfo {
            index,
            message: message.to_string(),
            commit_id: oid.to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        });
        true
    })
    .map_err(|e| git_err!("STASH_LIST_FAILED", "Failed to list stashes: {}", e))?;

    // reverse to show newest first
    stashes.reverse();
    Ok(stashes)
}

pub fn stash_pop(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_pop(index, None)
        .map_err(|e| git_err!("STASH_POP_FAILED", "Stash pop failed: {}", e))?;
    Ok(())
}

pub fn stash_apply(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_apply(index, None)
        .map_err(|e| git_err!("STASH_APPLY_FAILED", "Stash apply failed: {}", e))?;
    Ok(())
}

pub fn stash_drop(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_drop(index)
        .map_err(|e| git_err!("STASH_DROP_FAILED", "Stash drop failed: {}", e))?;
    Ok(())
}
