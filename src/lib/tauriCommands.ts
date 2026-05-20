import { invoke } from '@tauri-apps/api/core';
import type {
  RepoInfo,
  RecentRepo,
  CommitInfo,
  CommitDetail,
  FileStatus,
  DiffResult,
  BranchInfo,
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
