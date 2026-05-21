use git2::{Repository, StashFlags};
use crate::models::stash::StashInfo;

pub fn stash_save(repo: &mut Repository, message: Option<&str>) -> Result<(), String> {
    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let msg = message.unwrap_or("WIP");

    repo.stash_save(&signature, msg, Some(StashFlags::DEFAULT))
        .map_err(|e| {
            if e.code() == git2::ErrorCode::NotFound {
                "没有变更需要保存".to_string()
            } else {
                format!("Stash 保存失败: {}", e)
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
    .map_err(|e| format!("获取 Stash 列表失败: {}", e))?;

    // reverse to show newest first
    stashes.reverse();
    Ok(stashes)
}

pub fn stash_pop(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_pop(index, None)
        .map_err(|e| format!("Stash pop 失败: {}", e))?;
    Ok(())
}

pub fn stash_apply(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_apply(index, None)
        .map_err(|e| format!("Stash apply 失败: {}", e))?;
    Ok(())
}

pub fn stash_drop(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_drop(index)
        .map_err(|e| format!("Stash 删除失败: {}", e))?;
    Ok(())
}
