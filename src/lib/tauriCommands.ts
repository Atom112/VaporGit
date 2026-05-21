import { invoke } from '@tauri-apps/api/core';
import type {
  RepoInfo,
  RecentRepo,
  CommitInfo,
  CommitDetail,
  CommitGraphData,
  FileStatus,
  DiffResult,
  BranchInfo,
  RemoteInfo,
  ConflictEntry,
  StashInfo,
} from './types';

export async function openRepo(path: string): Promise<RepoInfo> {
  return invoke('open_repo', { path });
}

export async function getRecentRepos(): Promise<RecentRepo[]> {
  return invoke('get_recent_repos');
}

export async function getStatus(path: string): Promise<FileStatus[]> {
  return invoke('get_status', { path });
}

export async function stageFiles(path: string, files: string[]): Promise<void> {
  return invoke('stage_files', { path, files });
}

export async function unstageFiles(path: string, files: string[]): Promise<void> {
  return invoke('unstage_files', { path, files });
}

export async function commit(path: string, message: string): Promise<CommitInfo> {
  return invoke('commit', { path, message });
}

export async function getCommitHistory(
  path: string,
  page: number,
  pageSize: number
): Promise<CommitInfo[]> {
  return invoke('get_commit_history', { path, page, pageSize });
}

export async function getCommitDetail(
  path: string,
  commitId: string
): Promise<CommitDetail> {
  return invoke('get_commit_detail', { path, commitId });
}

export async function getFileDiff(
  path: string,
  filePath: string,
  oldCommit?: string,
  newCommit?: string
): Promise<DiffResult> {
  return invoke('get_file_diff', {
    path,
    filePath,
    oldCommit: oldCommit ?? null,
    newCommit: newCommit ?? null,
  });
}

export async function getFileContent(
  path: string,
  filePath: string,
  commitId?: string
): Promise<string> {
  return invoke('get_file_content', {
    path,
    filePath,
    commitId: commitId ?? null,
  });
}

export async function getCommitGraph(path: string): Promise<CommitGraphData> {
  return invoke('get_commit_graph', { path });
}

export async function getBranchList(path: string): Promise<BranchInfo[]> {
  return invoke('get_branch_list', { path });
}

export async function createBranch(
  path: string,
  name: string,
  from?: string
): Promise<void> {
  return invoke('create_branch', { path, name, from: from ?? null });
}

export async function checkoutBranch(path: string, name: string): Promise<void> {
  return invoke('checkout_branch', { path, name });
}

export async function deleteBranch(path: string, name: string): Promise<void> {
  return invoke('delete_branch', { path, name });
}

export async function fetch(path: string, remote?: string): Promise<void> {
  return invoke('fetch', { path, remote: remote ?? null });
}

export async function pull(
  path: string,
  remote?: string,
  branch?: string
): Promise<string> {
  return invoke('pull', { path, remote: remote ?? null, branch: branch ?? null });
}

export async function push(
  path: string,
  remote?: string,
  branch?: string
): Promise<void> {
  return invoke('push', { path, remote: remote ?? null, branch: branch ?? null });
}

export async function getRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke('get_remotes', { path });
}

export async function getConflicts(path: string): Promise<ConflictEntry[]> {
  return invoke('get_conflicts', { path });
}

export async function resolveConflict(path: string, file: string, resolution: string): Promise<void> {
  return invoke('resolve_conflict', { path, file, resolution });
}

export async function stashSave(path: string, message?: string): Promise<void> {
  return invoke('stash_save', { path, message: message ?? null });
}

export async function stashList(path: string): Promise<StashInfo[]> {
  return invoke('stash_list', { path });
}

export async function stashPop(path: string, index: number): Promise<void> {
  return invoke('stash_pop', { path, index });
}

export async function stashApply(path: string, index: number): Promise<void> {
  return invoke('stash_apply', { path, index });
}

export async function stashDrop(path: string, index: number): Promise<void> {
  return invoke('stash_drop', { path, index });
}

export async function rebase(path: string, onto: string): Promise<string> {
  return invoke('rebase', { path, onto });
}

export async function cherryPick(path: string, commitId: string): Promise<string> {
  return invoke('cherry_pick', { path, commitId });
}

export async function cloneRepo(url: string, path: string): Promise<RepoInfo> {
  return invoke('clone_repo', { url, path });
}
