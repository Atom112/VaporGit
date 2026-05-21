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
        .set_sorting(Sort::TOPOLOGICAL)
        .map_err(|e| format!("无法设置排序: {}", e))?;
    revwalk
        .push_head()
        .map_err(|e| format!("无法推送 HEAD: {}", e))?;

    let walk_oids: Vec<Oid> = revwalk.filter_map(|r| r.ok()).collect();

    if walk_oids.is_empty() {
        return Ok(CommitGraphData { nodes: vec![], edges: vec![] });
    }

    // Collect branch labels per commit OID
    let mut branch_labels: HashMap<Oid, Vec<String>> = HashMap::new();
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch_result in branches.flatten() {
            if let Some(oid) = branch_result.0.get().target() {
                let name = branch_result.0.name().ok().flatten().unwrap_or("").to_string();
                branch_labels.entry(oid).or_default().push(name);
            }
        }
    }

    // ── Phase 1: Collect and sort local branch tips ──
    // main/master always get lane 0; remaining branches sorted alphabetically.
    let walk_set: HashSet<Oid> = walk_oids.iter().copied().collect();
    let mut branch_refs: Vec<(Oid, String)> = Vec::new();
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch_result in branches.flatten() {
            if let Some(oid) = branch_result.0.get().target() {
                let name = branch_result.0.name().ok().flatten().unwrap_or("").to_string();
                if !name.is_empty() && walk_set.contains(&oid) {
                    branch_refs.push((oid, name));
                }
            }
        }
    }
    branch_refs.sort_by(|a, b| {
        let a_main = a.1 == "main" || a.1 == "master";
        let b_main = b.1 == "main" || b.1 == "master";
        match (a_main, b_main) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.1.cmp(&b.1),
        }
    });

    // ── Phase 2: First-parent walk from each branch tip ──
    // Assigns commits to their branch's lane. Stops when hitting an already-assigned
    // commit (the fork point where it rejoins another branch's first-parent chain).
    let mut commit_lane: HashMap<Oid, u32> = HashMap::new();
    for (i, (tip_oid, _)) in branch_refs.iter().enumerate() {
        let lane = i as u32;
        let mut oid = *tip_oid;
        loop {
            if !walk_set.contains(&oid) || commit_lane.contains_key(&oid) {
                break;
            }
            commit_lane.insert(oid, lane);
            match repo.find_commit(oid).ok().and_then(|c| c.parent_ids().next()) {
                Some(p) => oid = p,
                None => break,
            }
        }
    }

    // ── Phase 3: Active-columns fallback for remaining commits ──
    // Handles commits only reachable via non-first-parent paths (e.g. commits on a
    // branch that has since been deleted).
    let mut columns: Vec<(Oid, u32)> = Vec::new();

    /// Find the smallest available lane number not currently in use.
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
        if commit_lane.contains_key(oid) {
            // Already assigned by branch walk. Update frontier for first parent.
            if let Ok(commit) = repo.find_commit(*oid) {
                let parents: Vec<Oid> = commit.parent_ids().collect();
                if let Some(&fp) = parents.first() {
                    if walk_set.contains(&fp) && commit_lane.contains_key(&fp) {
                        columns.retain(|(c, _)| *c != fp);
                        columns.push((fp, commit_lane[&fp]));
                    }
                }
            }
            continue;
        }

        // Find in active frontier or assign a lane
        let col_idx = columns.iter().position(|(c, _)| *c == *oid);
        let lane = match col_idx {
            Some(idx) => {
                let (_, lane) = columns.remove(idx);
                lane
            }
            None => {
                if columns.is_empty() {
                    0
                } else {
                    // Try to use parent's lane for continuity
                    repo.find_commit(*oid).ok()
                        .and_then(|c| c.parent_ids().next())
                        .and_then(|p| commit_lane.get(&p))
                        .copied()
                        .unwrap_or_else(|| next_free_lane(&columns))
                }
            }
        };
        commit_lane.insert(*oid, lane);

        // Add parents to frontier
        if let Ok(commit) = repo.find_commit(*oid) {
            let parents: Vec<Oid> = commit.parent_ids().collect();
            if !parents.is_empty() {
                if !commit_lane.contains_key(&parents[0]) {
                    columns.retain(|(c, _)| *c != parents[0]);
                    columns.push((parents[0], lane));
                }
                // Additional parents get new lanes if not already in frontier
                for parent in parents.iter().skip(1) {
                    if !commit_lane.contains_key(parent)
                        && !columns.iter().any(|(c, _)| *c == *parent)
                    {
                        columns.push((*parent, next_free_lane(&columns)));
                    }
                }
            }
        }
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

    Ok(CommitGraphData { nodes, edges })
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
    let branch_name = head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string();

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