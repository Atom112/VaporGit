use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use git2::{Oid, Repository, Sort};
use crate::models::commit::{CommitInfo, CommitDetail, FileChange, CommitGraphData, GraphNode, GraphEdge};

pub fn commit(repo: &Repository, message: &str) -> Result<CommitInfo, String> {
    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("无法写入树: {}", e))?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("无法找到树: {}", e))?;

    let head = repo.head().ok();
    let parent_commits: Vec<_> = head
        .iter()
        .filter_map(|h| h.peel_to_commit().ok())
        .collect();
    let parents: Vec<&git2::Commit> = parent_commits.iter().collect();

    let commit_oid = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            parents.as_slice(),
        )
        .map_err(|e| format!("提交失败: {}", e))?;

    let commit = repo
        .find_commit(commit_oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    commit_to_info(&commit)
}

pub fn get_commit_history(
    repo: &Repository,
    page: u32,
    page_size: u32,
) -> Result<Vec<CommitInfo>, String> {
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("无法创建 revwalk: {}", e))?;

    revwalk.set_sorting(Sort::TIME).map_err(|e| format!("无法设置排序: {}", e))?;
    revwalk
        .push_head()
        .map_err(|e| format!("无法推送 HEAD: {}", e))?;

    let skip = (page * page_size) as usize;
    let take = page_size as usize;

    let oids: Vec<Oid> = revwalk
        .filter_map(|r| r.ok())
        .skip(skip)
        .take(take)
        .collect();

    let mut commits = Vec::new();
    for oid in oids {
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("无法找到提交: {}", e))?;
        commits.push(commit_to_info(&commit)?);
    }

    Ok(commits)
}

pub fn get_commit_detail(repo: &Repository, commit_id: &str) -> Result<CommitDetail, String> {
    let oid = Oid::from_str(commit_id).map_err(|e| format!("无效的提交 ID: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    let parent_tree = commit
        .parent(0)
        .ok()
        .and_then(|p| p.tree().ok());

    let current_tree = commit.tree().map_err(|e| format!("无法获取树: {}", e))?;

    let diff = repo
        .diff_tree_to_tree(
            parent_tree.as_ref(),
            Some(&current_tree),
            None,
        )
        .map_err(|e| format!("无法生成 diff: {}", e))?;

    let changed_files = RefCell::new(Vec::<FileChange>::new());

    diff.foreach(
        &mut |delta, _| {
            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                _ => "other",
            };

            let file_path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            changed_files.borrow_mut().push(FileChange {
                file_path,
                status: status.to_string(),
                additions: 0,
                deletions: 0,
            });
            true
        },
        None,
        None,
        Some(&mut |_delta, _hunk, line| {
            let mut files = changed_files.borrow_mut();
            if let Some(last) = files.last_mut() {
                match line.origin() {
                    '+' => last.additions += 1,
                    '-' => last.deletions += 1,
                    _ => {}
                }
            }
            true
        }),
    )
    .map_err(|e| format!("遍历 diff 失败: {}", e))?;

    let changed_files = changed_files.into_inner();

    let info = commit_to_info(&commit)?;

    Ok(CommitDetail {
        id: info.id,
        short_id: info.short_id,
        message: info.message,
        author: info.author,
        email: info.email,
        timestamp: info.timestamp,
        parent_ids: info.parent_ids,
        changed_files,
    })
}

pub fn get_commit_graph(repo: &Repository) -> Result<CommitGraphData, String> {
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("无法创建 revwalk: {}", e))?;
    revwalk
        .set_sorting(Sort::TIME)
        .map_err(|e| format!("无法设置排序: {}", e))?;

    // Push all local + remote-tracking branch tips so the commit graph
    // shows every branch. Use TIME sort so commits appear newest-first,
    // preventing remote PR merge commits from jumping to the front
    // purely due to topological ordering.
    let mut pushed_any = false;
    for branch_type in [Some(git2::BranchType::Local), Some(git2::BranchType::Remote)] {
        if let Ok(branches) = repo.branches(branch_type) {
            for branch_result in branches.flatten() {
                if let Some(oid) = branch_result.0.get().target() {
                    revwalk.push(oid).map_err(|e| format!("无法推送分支: {}", e))?;
                    pushed_any = true;
                }
            }
        }
    }
    if !pushed_any {
        revwalk
            .push_head()
            .map_err(|e| format!("无法推送 HEAD: {}", e))?;
    }

    let walk_oids: Vec<Oid> = revwalk.filter_map(|r| r.ok()).collect();

    // Limit to max 2000 commits for performance on large repos
    const MAX_GRAPH_COMMITS: usize = 2000;
    let truncated = walk_oids.len() > MAX_GRAPH_COMMITS;
    let walk_oids: Vec<Oid> = walk_oids.into_iter().take(MAX_GRAPH_COMMITS).collect();

    if walk_oids.is_empty() {
        return Ok(CommitGraphData { nodes: vec![], edges: vec![], truncated: false });
    }

    // Collect branch labels per commit OID (local + remote)
    let mut branch_labels: HashMap<Oid, Vec<String>> = HashMap::new();
    for branch_type in [Some(git2::BranchType::Local), Some(git2::BranchType::Remote)] {
        if let Ok(branches) = repo.branches(branch_type) {
            for branch_result in branches.flatten() {
                if let Some(oid) = branch_result.0.get().target() {
                    let name = branch_result.0.name().ok().flatten().unwrap_or("").to_string();
                    if !name.is_empty() {
                        branch_labels.entry(oid).or_default().push(name);
                    }
                }
            }
        }
    }

    // Collect tag labels per commit OID
    let mut tag_labels: HashMap<Oid, Vec<String>> = HashMap::new();
    if let Ok(tag_names) = repo.tag_names(None) {
        for tag_name in tag_names.iter().flatten() {
            let ref_name = format!("refs/tags/{}", tag_name);
            if let Ok(reference) = repo.find_reference(&ref_name) {
                if let Ok(commit) = reference.peel_to_commit() {
                    let oid = commit.id();
                    tag_labels.entry(oid).or_default().push(tag_name.to_string());
                }
            }
        }
    }

    // ── GitKraken-style column-based lane assignment ──
    // Algorithm: walk commits in topological order (children before parents),
    // maintaining a set of "active columns". Each active column represents a
    // pending lane claimed by a child commit and awaiting its parent.
    //   - First parent inherits the child's lane (straight vertical line)
    //   - Additional parents (merge commits) get new lanes (curved lines)
    //   - When a commit appears in multiple active columns, pick the first
    //     (the other pending entries become merged-in branches drawn as curves)
    let walk_set: HashSet<Oid> = walk_oids.iter().copied().collect();
    let mut commit_lane: HashMap<Oid, u32> = HashMap::new();
    // active_columns: ordered by lane, each entry is (commit_oid, lane_number)
    let mut active_columns: Vec<(Oid, u32)> = Vec::new();

    /// Return the smallest non-negative lane number not currently in use.
    fn next_free_lane(columns: &[(Oid, u32)]) -> u32 {
        let mut used: Vec<u32> = columns.iter().map(|(_, l)| *l).collect();
        used.sort();
        let mut c = 0u32;
        for &u in &used {
            if u > c {
                break;
            }
            c = u + 1;
        }
        c
    }

    for oid in &walk_oids {
        // Collect ALL active-column entries for this OID (there may be
        // multiple when several branches converge to the same parent).
        let mut claimed_lanes: Vec<u32> = Vec::new();
        active_columns.retain(|(c, lane)| {
            if *c == *oid {
                claimed_lanes.push(*lane);
                false
            } else {
                true
            }
        });

        // Use the first (lowest numerical) claimed lane, or allocate a new one.
        let lane = claimed_lanes.first().copied().unwrap_or_else(|| next_free_lane(&active_columns));
        commit_lane.insert(*oid, lane);

        // Schedule parents
        if let Ok(commit) = repo.find_commit(*oid) {
            let parents: Vec<Oid> = commit.parent_ids().collect();

            if let Some(&first_parent) = parents.first() {
                // First parent inherits this commit's lane
                if walk_set.contains(&first_parent)
                    && !commit_lane.contains_key(&first_parent)
                    && !active_columns.iter().any(|(c, _)| *c == first_parent)
                {
                    active_columns.push((first_parent, lane));
                }
            }

            // Additional (merge) parents get new lanes
            if parents.len() > 1 {
                for parent in parents.iter().skip(1) {
                    if walk_set.contains(parent)
                        && !commit_lane.contains_key(parent)
                        && !active_columns.iter().any(|(c, _)| *c == *parent)
                    {
                        let nl = next_free_lane(&active_columns);
                        active_columns.push((*parent, nl));
                    }
                }
            }
        }

        // Keep columns sorted by lane number for deterministic behaviour
        active_columns.sort_by_key(|(_, l)| *l);
    }

    // Assign row numbers based on walk order
    let order: HashMap<Oid, usize> = walk_oids.iter().enumerate().map(|(i, o)| (*o, i)).collect();

    // Determine HEAD commit for highlighting
    let head_oid = repo.head().ok().and_then(|h| h.target());

    // Build nodes
    let nodes: Vec<GraphNode> = walk_oids
        .iter()
        .map(|oid| {
            let row = *order.get(oid).unwrap_or(&0) as u32;
            let lane = *commit_lane.get(oid).unwrap_or(&0);

            let (id, short_id, message, author, timestamp) = repo
                .find_commit(*oid)
                .ok()
                .map(|c| {
                    let id_str = c.id().to_string();
                    let sid = id_str[..8.min(id_str.len())].to_string();
                    let msg = c.message().unwrap_or("").lines().next().unwrap_or("").to_string();
                    let author_name = c.author().name().unwrap_or("Unknown").to_string();
                    (id_str, sid, msg, author_name, c.time().seconds())
                })
                .unwrap_or_else(|| (oid.to_string(), oid.to_string(), String::new(), "Unknown".to_string(), 0));

            GraphNode {
                id,
                short_id,
                message,
                author,
                timestamp,
                branch_labels: branch_labels.get(oid).cloned().unwrap_or_default(),
                tag_labels: tag_labels.get(oid).cloned().unwrap_or_default(),
                lane,
                color: lane,
                row,
                is_head: head_oid == Some(*oid),
            }
        })
        .collect();

    // Build edges (only between nodes in the walk)
    let mut edges = Vec::new();
    for oid in &walk_oids {
        if let Ok(commit) = repo.find_commit(*oid) {
            for parent in commit.parent_ids() {
                if walk_set.contains(&parent) {
                    edges.push(GraphEdge {
                        from: oid.to_string(),
                        to: parent.to_string(),
                    });
                }
            }
        }
    }

    Ok(CommitGraphData { nodes, edges, truncated })
}

fn commit_to_info(commit: &git2::Commit) -> Result<CommitInfo, String> {
    let id = commit.id();
    let id_str = id.to_string();
    let short_id = id_str[..8.min(id_str.len())].to_string();
    let message = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();
    let author = commit.author();
    let timestamp = commit.time().seconds();
    let parent_ids: Vec<String> = commit.parent_ids().map(|p| p.to_string()).collect();

    Ok(CommitInfo {
        id: id_str,
        short_id,
        message,
        author: author.name().unwrap_or("Unknown").to_string(),
        email: author.email().unwrap_or("").to_string(),
        timestamp,
        parent_ids,
    })
}

pub fn rebase(repo: &Repository, onto: &str) -> Result<String, String> {
    let onto_commit = repo
        .revparse_single(onto)
        .map_err(|e| format!("无法解析目标 '{}': {}", onto, e))?
        .peel_to_commit()
        .map_err(|e| format!("无法获取目标提交: {}", e))?;

    let onto_annotated = repo
        .find_annotated_commit(onto_commit.id())
        .map_err(|e| format!("无法创建 annotated commit: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?;

    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    let head_annotated = repo
        .find_annotated_commit(head_commit.id())
        .map_err(|e| format!("无法创建 HEAD annotated commit: {}", e))?;

    let mut rebase_opts = git2::RebaseOptions::new();
    rebase_opts.checkout_options(git2::build::CheckoutBuilder::new());

    let mut rebase = repo
        .rebase(
            Some(&head_annotated),
            Some(&onto_annotated),
            None,
            Some(&mut rebase_opts),
        )
        .map_err(|e| format!("无法初始化变基: {}", e))?;

    let mut commit_count = 0;
    loop {
        let op = rebase.next();
        match op {
            Some(Ok(_)) => {
                commit_count += 1;
                if let Ok(index) = repo.index() {
                    if index.has_conflicts() {
                        rebase.abort().ok();
                        return Ok(format!("变基过程中出现冲突，已中止。已处理 {} 个提交。请解决冲突后手动继续。", commit_count));
                    }
                }
            }
            Some(Err(e)) => {
                rebase.abort().ok();
                return Err(format!("变基失败: {}", e));
            }
            None => break,
        }
    }

    rebase
        .finish(None)
        .map_err(|e| format!("变基完成失败: {}", e))?;

    Ok(format!("变基完成，共处理 {} 个提交", commit_count))
}

pub fn cherry_pick(repo: &Repository, commit_id: &str) -> Result<String, String> {
    let oid = Oid::from_str(commit_id)
        .map_err(|e| format!("无效的提交 ID: {}", e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    let mut opts = git2::CherrypickOptions::new();
    opts.checkout_builder(git2::build::CheckoutBuilder::new());
    repo.cherrypick(&commit, Some(&mut opts))
        .map_err(|e| format!("Cherry-pick 失败: {}", e))?;

    // Check for conflicts
    let index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    if index.has_conflicts() {
        repo.cleanup_state().ok();
        return Ok("Cherry-pick 出现冲突，请手动解决后提交".to_string());
    }
    drop(index);

    // Create the commit
    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let tree_oid = repo
        .index()
        .map_err(|e| format!("无法获取索引: {}", e))?
        .write_tree()
        .map_err(|e| format!("无法写入树: {}", e))?;

    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("无法找到树: {}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    let msg = commit
        .message()
        .unwrap_or("Cherry-pick")
        .to_string();

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &format!("cherry-pick: {}", msg.lines().next().unwrap_or(&msg)),
        &tree,
        &[&head_commit],
    )
    .map_err(|e| format!("Cherry-pick 提交失败: {}", e))?;

    repo.cleanup_state()
        .map_err(|e| format!("清理状态失败: {}", e))?;

    Ok("Cherry-pick 成功".to_string())
}

/// Revert a commit by creating a new commit that undoes its changes.
pub fn revert_commit(repo: &Repository, commit_id: &str) -> Result<String, String> {
    let oid = Oid::from_str(commit_id).map_err(|e| format!("无效的提交 ID: {}", e))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("无法找到提交: {}", e))?;

    let mut opts = git2::RevertOptions::new();
    opts.checkout_builder(git2::build::CheckoutBuilder::new());
    repo.revert(&commit, Some(&mut opts))
        .map_err(|e| format!("Revert 失败: {}", e))?;

    // Check for conflicts
    let index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    if index.has_conflicts() {
        repo.cleanup_state().ok();
        return Ok("Revert 出现冲突，请手动解决后提交".to_string());
    }
    drop(index);

    // Create the revert commit
    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    let tree_oid = repo
        .index()
        .map_err(|e| format!("无法获取索引: {}", e))?
        .write_tree()
        .map_err(|e| format!("无法写入树: {}", e))?;

    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("无法找到树: {}", e))?;

    let head_commit = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?
        .peel_to_commit()
        .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    let msg = commit
        .message()
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &format!("Revert \"{}\"", msg),
        &tree,
        &[&head_commit],
    )
    .map_err(|e| format!("Revert 提交失败: {}", e))?;

    repo.cleanup_state()
        .map_err(|e| format!("清理状态失败: {}", e))?;

    Ok(format!("成功 revert 提交 {}", msg))
}

/// Undo the last commit via soft reset (keeps changes staged).
pub fn undo(repo: &Repository) -> Result<String, String> {
    let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_commit = head.peel_to_commit().map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    // Check there is at least one parent to reset to
    if head_commit.parents().len() == 0 {
        return Err("没有可撤销的提交（已经是第一个提交）".to_string());
    }

    let msg = head_commit.message().unwrap_or("").to_string();

    // Get the parent's OID
    let parent = head_commit.parent(0).map_err(|e| format!("无法获取父提交: {}", e))?;
    let parent_oid = parent.id();

    // Soft reset to the parent
    let mut checkout = git2::build::CheckoutBuilder::new();
    // --soft: only move HEAD, don't touch index/worktree
    repo.reset(&repo.find_object(parent_oid, None).map_err(|e| format!("无法解析父提交: {}", e))?, git2::ResetType::Soft, Some(&mut checkout))
        .map_err(|e| format!("重置失败: {}", e))?;

    Ok(msg)
}

/// Redo: commit again using the previous commit's message (from reflog HEAD@{1}).
pub fn redo(repo: &Repository) -> Result<String, String> {
    // Read HEAD reflog to find the previous commit message
    let reflog = repo.reflog("HEAD").map_err(|e| format!("无法读取 reflog: {}", e))?;

    // reflog entry 0 is the current state, entry 1 is the previous HEAD
    if reflog.len() < 2 {
        return Err("没有可重做的操作".to_string());
    }

    let prev_entry = reflog.get(1).ok_or("没有可重做的操作".to_string())?;
    let prev_msg: &str = prev_entry.message().unwrap_or("redo");
    // Extract the actual commit message from the reflog message ("commit: <msg>" or "reset: ...")
    let commit_msg = if let Some(msg) = prev_msg.strip_prefix("commit: ") {
        msg.to_string()
    } else if let Some(msg) = prev_msg.strip_prefix("commit (amend): ") {
        msg.to_string()
    } else {
        prev_msg.to_string()
    };

    let signature = repo.signature().map_err(|e| format!("无法获取签名: {}", e))?;

    let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("无法写入树: {}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("无法找到树: {}", e))?;

    let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_commit = head.peel_to_commit().map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &commit_msg,
        &tree,
        &[&head_commit],
    )
    .map_err(|e| format!("重做提交失败: {}", e))?;

    Ok(commit_msg)
}