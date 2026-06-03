use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use git2::{Oid, Repository, Sort};
use crate::models::commit::{CommitInfo, CommitDetail, FileChange, CommitGraphData, GraphNode, GraphEdge, RebaseEntry};

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

/// Search commit history by message and/or author.
/// Performs case-insensitive substring matching.
pub fn search_commit_history(
    repo: &Repository,
    query: &str,
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

    let query_lower = query.to_lowercase();

    // Walk all commits, filter by query, then paginate
    let query = query_lower;
    let mut matching: Vec<CommitInfo> = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| format!("遍历提交失败: {}", e))?;
        let commit = repo.find_commit(oid).map_err(|e| format!("无法找到提交: {}", e))?;

        let msg = commit.message().unwrap_or("").to_lowercase();
        let author = commit.author().name().unwrap_or("").to_lowercase();

        if msg.contains(&query) || author.contains(&query) {
            matching.push(commit_to_info(&commit)?);
        }
    }

    let skip = (page * page_size) as usize;
    let take = page_size as usize;
    let paginated: Vec<CommitInfo> = matching.into_iter().skip(skip).take(take).collect();

    Ok(paginated)
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
                        // Collect conflicted files for the user
                        let conflict_files: Vec<String> = index.conflicts()
                            .map_err(|e| format!("无法读取冲突: {}", e))?
                            .filter_map(|c| c.ok())
                            .filter_map(|c| {
                                c.ancestor.as_ref()
                                    .or_else(|| c.our.as_ref())
                                    .or_else(|| c.their.as_ref())
                                    .and_then(|e| std::str::from_utf8(&e.path).ok())
                                    .map(|p| p.to_string())
                            })
                            .collect();
                        rebase.abort().ok();
                        let files_str = conflict_files.join("、");
                        return Ok(format!(
                            "变基过程中出现冲突，已中止。已处理 {} 个提交。\n冲突文件：{}\n请解决冲突后，使用终端手动执行 git rebase --continue",
                            commit_count, files_str
                        ));
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

/// Continue a rebase after resolving conflicts (not yet implemented, use terminal).
#[allow(dead_code)]
pub fn continue_rebase(_repo: &Repository) -> Result<String, String> {
    Err("暂不支持图形界面继续变基，请使用终端执行 git rebase --continue".to_string())
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
    let msg_first_line = msg.lines().next().unwrap_or(&msg);
    let short_sha = &commit_id[..8.min(commit_id.len())];

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &format!("cherry-pick: {} ({})", msg_first_line, short_sha),
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
    let short_sha = &commit_id[..8.min(commit_id.len())];

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &format!("Revert \"{}\" ({})", msg, short_sha),
        &tree,
        &[&head_commit],
    )
    .map_err(|e| format!("Revert 提交失败: {}", e))?;

    repo.cleanup_state()
        .map_err(|e| format!("清理状态失败: {}", e))?;

    Ok(format!("成功 revert 提交 {}", msg))
}

/// Amend the last commit (replace HEAD with a new commit using the current index).
pub fn amend_commit(repo: &Repository, message: &str) -> Result<CommitInfo, String> {
    let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_commit = head.peel_to_commit().map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

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

    // Collect parents from HEAD's parents (same parents, replacing HEAD itself)
    let parent_commits: Vec<git2::Commit> = head_commit.parents().collect();
    let parents: Vec<&git2::Commit> = parent_commits.iter().collect();

    let new_oid = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            parents.as_slice(),
        )
        .map_err(|e| format!("修改提交失败: {}", e))?;

    let new_commit = repo
        .find_commit(new_oid)
        .map_err(|e| format!("无法找到新提交: {}", e))?;

    commit_to_info(&new_commit)
}

/// Undo the last commit via soft reset (keeps changes staged).
///
/// NOTE: This is a soft reset — index and working tree are preserved.
/// The undone commit's content remains staged and can be re-committed.
/// If you modify files after undo, the original tree is lost from the
/// index (but still available in git reflog).
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

/// Redo by restoring the exact commit that was undone.
///
/// Reads the previous HEAD OID from the reflog (entry 1), then creates a new
/// commit using the **original tree** (not the current index), ensuring the
/// restored commit is identical in content to the one that was undone.
pub fn redo(repo: &Repository) -> Result<String, String> {
    let reflog = repo.reflog("HEAD").map_err(|e| format!("无法读取 reflog: {}", e))?;

    if reflog.len() < 2 {
        return Err("没有可重做的操作".to_string());
    }

    // reflog.get(1) contains the entry for the state BEFORE the undo.
    // id_new() gives the OID of the commit at that point (the one we want to restore).
    let prev_entry = reflog.get(1).ok_or("没有可重做的操作".to_string())?;
    let prev_oid = prev_entry.id_new();
    let prev_msg = prev_entry.message().unwrap_or("redo");

    // Get the original commit to restore its tree
    let prev_commit = repo.find_commit(prev_oid)
        .map_err(|_| "无法找到之前的提交，可能已被垃圾回收".to_string())?;

    // Use the original tree from the undone commit
    let original_tree = prev_commit.tree()
        .map_err(|e| format!("无法获取原始提交树: {}", e))?;

    // Extract commit message from reflog
    let commit_msg = if let Some(msg) = prev_msg.strip_prefix("commit: ") {
        msg.to_string()
    } else if let Some(msg) = prev_msg.strip_prefix("commit (amend): ") {
        msg.to_string()
    } else {
        // Fall back to the original commit message
        prev_commit.message().unwrap_or("redo").to_string()
    };

    let signature = repo.signature().map_err(|e| format!("无法获取签名: {}", e))?;

    let head = repo.head().map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_commit = head.peel_to_commit().map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    // Commit using the original tree — this ensures the restored commit
    // has the exact same content as the one that was undone
    let new_oid = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &commit_msg,
        &original_tree,
        &[&head_commit],
    )
    .map_err(|e| format!("重做提交失败: {}", e))?;

    // Reset index to match the restored commit (so the working state reflects it)
    let obj = repo.find_object(new_oid, None)
        .map_err(|e| format!("无法找到重做提交: {}", e))?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    repo.reset(&obj, git2::ResetType::Mixed, Some(&mut checkout))
        .map_err(|e| format!("重置索引失败: {}", e))?;

    Ok(commit_msg)
}

/// List commits that will be affected by a rebase from current HEAD onto `onto_branch`.
/// Returns commits in order from oldest to newest (the order they will be applied).
pub fn list_rebase_commits(
    repo: &Repository,
    onto_branch: &str,
) -> Result<Vec<RebaseEntry>, String> {
    let onto_obj = repo
        .revparse_single(onto_branch)
        .map_err(|e| format!("无法解析目标分支 '{}': {}", onto_branch, e))?;
    let onto_commit = onto_obj
        .peel_to_commit()
        .map_err(|e| format!("无法获取目标分支提交: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("无法获取 HEAD: {}", e))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("无法获取 HEAD 提交: {}", e))?;

    // Find merge base
    let merge_base_oid = repo
        .merge_base(onto_commit.id(), head_commit.id())
        .map_err(|e| format!("无法计算合并基础: {}", e))?;

    // Walk from HEAD to merge_base (exclusive)
    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("无法创建 revwalk: {}", e))?;
    revwalk
        .push(head_commit.id())
        .map_err(|e| format!("无法推送 HEAD: {}", e))?;
    revwalk.set_sorting(Sort::TOPOLOGICAL)
        .map_err(|e| format!("无法设置排序: {}", e))?;

    // Collect commits until we hit the merge base
    let mut entries: Vec<RebaseEntry> = Vec::new();
    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| format!("遍历提交失败: {}", e))?;
        if oid == merge_base_oid {
            break;
        }

        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("无法找到提交: {}", e))?;

        let id_str = oid.to_string();
        let short_id = id_str[..8.min(id_str.len())].to_string();
        let msg = commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();
        let author = commit.author().name().unwrap_or("Unknown").to_string();

        entries.push(RebaseEntry {
            commit_id: id_str,
            short_id,
            message: msg,
            author,
            timestamp: commit.time().seconds(),
            action: "pick".to_string(),
            new_message: None,
        });
    }

    // Reverse so oldest commit is first (rebase applies from oldest to newest)
    entries.reverse();

    if entries.is_empty() {
        return Err("当前分支已基于目标分支的最新提交，无需变基".to_string());
    }

    Ok(entries)
}

/// Perform an interactive rebase with the given entries.
/// Each entry specifies an action: pick, squash, reword, drop, fixup.
/// The entries are applied in the order given (oldest to newest).
pub fn perform_interactive_rebase(
    repo: &Repository,
    onto_branch: &str,
    entries: &[RebaseEntry],
) -> Result<String, String> {
    let onto_obj = repo
        .revparse_single(onto_branch)
        .map_err(|e| format!("无法解析目标分支 '{}': {}", onto_branch, e))?;
    let onto_commit = onto_obj
        .peel_to_commit()
        .map_err(|e| format!("无法获取目标分支提交: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("无法获取签名: {}", e))?;

    // Soft reset HEAD to the onto branch (this moves HEAD, keeps index + worktree)
    let mut checkout = git2::build::CheckoutBuilder::new();
    repo.reset(
        onto_commit.as_object(),
        git2::ResetType::Soft,
        Some(&mut checkout),
    )
    .map_err(|e| format!("重置到目标分支失败: {}", e))?;

    let mut last_commit_oid: Option<git2::Oid> = None;
    let mut squashed_tree: Option<git2::Tree> = None;
    let mut total_applied = 0u32;

    for entry in entries {
        match entry.action.as_str() {
            "drop" => continue,
            "pick" | "squash" | "fixup" | "reword" => {
                let commit_oid = git2::Oid::from_str(&entry.commit_id)
                    .map_err(|e| format!("无效的提交 ID: {}", e))?;
                let commit = repo
                    .find_commit(commit_oid)
                    .map_err(|e| format!("无法找到提交: {}", e))?;

                let is_squash = entry.action == "squash" || entry.action == "fixup";

                // Cherry-pick the commit
                let mut cp_opts = git2::CherrypickOptions::new();
                cp_opts.checkout_builder(git2::build::CheckoutBuilder::new());
                repo.cherrypick(&commit, Some(&mut cp_opts))
                    .map_err(|e| format!("Cherry-pick 提交 {} 失败: {}", entry.short_id, e))?;

                // Check for conflicts
                let mut index = repo.index().map_err(|e| format!("无法获取索引: {}", e))?;
                if index.has_conflicts() {
                    repo.cleanup_state().ok();
                    repo.reset(onto_commit.as_object(), git2::ResetType::Soft, None).ok();
                    return Err(format!(
                        "变基过程中出现冲突 (提交 {})，已中止。请手动解决冲突后使用终端执行 git rebase --continue",
                        entry.short_id
                    ));
                }

                let tree_oid = index
                    .write_tree()
                    .map_err(|e| format!("无法写入树: {}", e))?;
                drop(index);

                let tree = repo
                    .find_tree(tree_oid)
                    .map_err(|e| format!("无法找到树: {}", e))?;

                if is_squash {
                    // For squash/fixup: store the tree and keep the last commit
                    // We don't commit yet — we'll combine with the previous one
                    squashed_tree = Some(tree);
                    continue;
                }

                // Regular pick or reword: create a commit
                let msg = if entry.action == "reword" {
                    entry
                        .new_message
                        .as_deref()
                        .unwrap_or(commit.message().unwrap_or(""))
                } else {
                    commit.message().unwrap_or("")
                };

                let head_commit = repo
                    .head()
                    .map_err(|e| format!("无法获取 HEAD: {}", e))?
                    .peel_to_commit()
                    .ok();

                let parents: Vec<&git2::Commit> = head_commit.iter().collect();

                let new_oid = repo
                    .commit(Some("HEAD"), &signature, &signature, msg, &tree, parents.as_slice())
                    .map_err(|e| format!("创建提交失败: {}", e))?;

                last_commit_oid = Some(new_oid);
                total_applied += 1;
            }
            _ => return Err(format!("未知的操作: {}", entry.action)),
        }
    }

    // Handle trailing squash/fixup: combine with the last commit
    if let Some(tree) = squashed_tree {
        if let Some(prev_oid) = last_commit_oid {
            // Amend the last commit with the combined tree
            let prev_commit = repo
                .find_commit(prev_oid)
                .map_err(|e| format!("无法找到前一个提交: {}", e))?;
            let parent_refs: Vec<git2::Commit> = prev_commit.parents().collect();
            let parents: Vec<&git2::Commit> = parent_refs.iter().collect();

            // For squash: keep the last entry's message
            let last_squash_entry = entries
                .iter()
                .filter(|e| e.action == "squash" || e.action == "fixup")
                .last();

            let msg = match last_squash_entry {
                Some(e) if e.action == "fixup" => {
                    // Fixup: keep the original previous commit message
                    prev_commit.message().unwrap_or("").to_string()
                }
                Some(e) => {
                    // Squash: use the squashed commit's message
                    let commit = repo
                        .find_commit(git2::Oid::from_str(&e.commit_id).unwrap())
                        .ok();
                    commit
                        .and_then(|c| c.message().map(|m| m.to_string()))
                        .unwrap_or_else(|| e.message.clone())
                }
                None => prev_commit.message().unwrap_or("").to_string(),
            };

            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                &msg,
                &tree,
                parents.as_slice(),
            )
            .map_err(|e| format!("创建组合提交失败: {}", e))?;

            total_applied += 1;
        } else {
            // No previous commit, create a new one directly
            let msg = entries
                .iter()
                .find(|e| e.action == "squash" || e.action == "fixup")
                .map(|e| e.message.clone())
                .unwrap_or_else(|| "squash".to_string());

            let head_commit = repo
                .head()
                .map_err(|e| format!("无法获取 HEAD: {}", e))?
                .peel_to_commit()
                .ok();
            let parents: Vec<&git2::Commit> = head_commit.iter().collect();

            repo.commit(Some("HEAD"), &signature, &signature, &msg, &tree, parents.as_slice())
                .map_err(|e| format!("创建提交失败: {}", e))?;

            total_applied += 1;
        }
    }

    Ok(format!("变基完成，共处理 {} 个提交", total_applied))
}