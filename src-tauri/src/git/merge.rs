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
        .map_err(|e| format!("无法解析分支 '{}': {}", branch_name, e))?
        .peel_to_commit()
        .map_err(|e| format!("无法获取分支 '{}' 的提交: {}", branch_name, e))?;

    let target_annotated = repo
        .find_annotated_commit(target_commit.id())
        .map_err(|e| format!("无法创建 annotated commit: {}", e))?;

    let (analysis, _pref) = repo
        .merge_analysis(&[&target_annotated])
        .map_err(|e| format!("合并分析失败: {}", e))?;

    if analysis.is_up_to_date() {
        return Ok("已经是最新的".to_string());
    }

    match strategy {
        "fast_forward" => {
            if !analysis.is_fast_forward() {
                return Err("无法快进合并，请选择其他合并策略".to_string());
            }
            fast_forward_merge(repo, &target_ref, target_commit.id())
        }
        "squash" => squash_merge(repo, target_commit.id()),
        _ => normal_merge(repo, target_commit.id()),
    }
}

fn fast_forward_merge(repo: &Repository, _target_ref: &str, target_oid: git2::Oid) -> Result<String, String> {
    let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_name = head.name().ok_or_else(|| "HEAD 没有名称".to_string())?.to_string();

    let mut reference = repo
        .find_reference(&head_name)
        .map_err(|e| format!("无法找到引用: {}", e))?;

    reference
        .set_target(target_oid, "Fast-forward merge")
        .map_err(|e| format!("快进合并失败: {}", e))?;

    repo.set_head(&head_name)
        .map_err(|e| format!("设置 HEAD 失败: {}", e))?;

    repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
        .map_err(|e| format!("检出失败: {}", e))?;

    Ok("快进合并完成".to_string())
}

fn normal_merge(repo: &Repository, target_oid: git2::Oid) -> Result<String, String> {
    let target_annotated = repo
        .find_annotated_commit(target_oid)
        .map_err(|e| format!("无法创建 annotated commit: {}", e))?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    repo.merge(
        &[&target_annotated],
        None,
        Some(&mut checkout_builder),
    )
    .map_err(|e| format!("合并失败: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("无法获取索引: {}", e))?;

    if index.has_conflicts() {
        // Clean up merge state so the user can resolve conflicts
        return Ok("合并出现冲突，请解决冲突后提交".to_string());
    }

    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("无法写入树: {}", e))?;

    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("无法找到树: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    let merge_commit = repo
        .find_commit(target_oid)
        .map_err(|e| format!("无法找到合并提交: {}", e))?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        "Merge branch",
        &tree,
        &[&head_commit, &merge_commit],
    )
    .map_err(|e| format!("合并提交失败: {}", e))?;

    repo.cleanup_state()
        .map_err(|e| format!("清理状态失败: {}", e))?;

    Ok("合并完成".to_string())
}

fn squash_merge(repo: &Repository, target_oid: git2::Oid) -> Result<String, String> {
    let target_annotated = repo
        .find_annotated_commit(target_oid)
        .map_err(|e| format!("无法创建 annotated commit: {}", e))?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    let mut merge_opts = git2::MergeOptions::new();

    repo.merge(
        &[&target_annotated],
        Some(&mut merge_opts),
        Some(&mut checkout_builder),
    )
    .map_err(|e| format!("Squash 合并失败: {}", e))?;

    // Mark as squash merge in the index
    if let Ok(index) = repo.index() {
        if index.has_conflicts() {
            return Ok("Squash 合并出现冲突，请解决冲突后提交".to_string());
        }
    }

    // Don't create a merge commit — let the user commit manually
    repo.cleanup_state()
        .map_err(|e| format!("清理状态失败: {}", e))?;

    Ok("Squash 合并完成，变更已暂存，请提交".to_string())
}
