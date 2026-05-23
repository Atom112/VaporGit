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
  GitHubUser,
  GitHubRepo,
  GitHubBranch,
  GitHubPullRequest,
  CreatePullRequest,
  MergePullRequest,
  MergePullResult,
  PullRequestFile,
  PRComment,
  AuthStatus,
  GitHubReleaseAsset,
  UpdateInfo,
} from './types';

export async function openRepo(path: string): Promise<RepoInfo> {
  return invoke('open_repo', { path });
}

export async function getRecentRepos(): Promise<RecentRepo[]> {
  return invoke('get_recent_repos');
}

export async function removeRecentRepo(path: string): Promise<void> {
  return invoke('remove_recent_repo', { path });
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

export async function getFileBase64(path: string, filePath: string, commitId?: string): Promise<string | null> {
  return invoke('get_file_base64', { path, filePath, commitId: commitId ?? null });
}

export async function checkLfs(path: string, filePath: string): Promise<boolean> {
  return invoke('check_lfs', { path, filePath });
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

export async function checkoutRemoteBranch(path: string, name: string): Promise<void> {
  return invoke('checkout_remote_branch', { path, name });
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

export async function checkSubmodules(path: string): Promise<string[]> {
  return invoke('check_submodules', { path });
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

export async function undo(path: string): Promise<string> {
  return invoke('undo', { path });
}

export async function redo(path: string): Promise<string> {
  return invoke('redo', { path });
}

export async function cloneRepo(url: string, path: string): Promise<RepoInfo> {
  return invoke('clone_repo', { url, path });
}

export async function initRepo(path: string, initReadme: boolean): Promise<RepoInfo> {
  return invoke('init_repo', { path, initReadme });
}

// === GitHub ===

export async function githubLogin(): Promise<GitHubUser> {
  return invoke('github_login');
}

export async function githubCheckAuth(): Promise<AuthStatus> {
  return invoke('github_check_auth');
}

export async function githubLogout(): Promise<void> {
  return invoke('github_logout');
}

export async function githubGetUser(): Promise<GitHubUser> {
  return invoke('github_get_user');
}

export async function githubCreateRepo(name: string, description: string | null, private_: boolean): Promise<GitHubRepo> {
  return invoke('github_create_repo', { name, description, private: private_ });
}

export async function pushToGitHub(repoPath: string, owner: string, repoName: string, branch: string): Promise<void> {
  return invoke('push_to_github', { repoPath, owner, repoName, branch });
}

export async function githubListRepos(page?: number, perPage?: number): Promise<GitHubRepo[]> {
  return invoke('github_list_repos', { page: page ?? null, perPage: perPage ?? null });
}

export async function githubGetRepo(owner: string, repo: string): Promise<GitHubRepo> {
  return invoke('github_get_repo', { owner, repo });
}

export async function githubListBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  return invoke('github_list_branches', { owner, repo });
}

export async function githubListPulls(
  owner: string,
  repo: string,
  state?: string,
  page?: number,
  perPage?: number
): Promise<GitHubPullRequest[]> {
  return invoke('github_list_pulls', {
    owner,
    repo,
    state: state ?? null,
    page: page ?? null,
    perPage: perPage ?? null,
  });
}

export async function githubGetPull(owner: string, repo: string, number: number): Promise<GitHubPullRequest> {
  return invoke('github_get_pull', { owner, repo, number });
}

export async function githubCreatePull(
  owner: string,
  repo: string,
  request: CreatePullRequest
): Promise<GitHubPullRequest> {
  return invoke('github_create_pull', { owner, repo, request });
}

export async function githubMergePull(
  owner: string,
  repo: string,
  number: number,
  request: MergePullRequest
): Promise<MergePullResult> {
  return invoke('github_merge_pull', { owner, repo, number, request });
}

export async function githubGetPullFiles(
  owner: string,
  repo: string,
  number: number
): Promise<PullRequestFile[]> {
  return invoke('github_get_pull_files', { owner, repo, number });
}

export async function githubGetPullDiff(owner: string, repo: string, number: number): Promise<string> {
  return invoke('github_get_pull_diff', { owner, repo, number });
}

export async function githubListPullComments(
  owner: string,
  repo: string,
  number: number
): Promise<PRComment[]> {
  return invoke('github_list_pull_comments', { owner, repo, number });
}

export async function checkUpdate(): Promise<UpdateInfo | null> {
  return invoke('check_update');
}

export async function githubCreatePullComment(
  owner: string,
  repo: string,
  number: number,
  body: string,
  commitId: string,
  path: string,
  position: number
): Promise<PRComment> {
  return invoke('github_create_pull_comment', { owner, repo, number, body, commitId, path, position });
}

export async function githubGetAsset(release: UpdateInfo): Promise<GitHubReleaseAsset | null> {
  return invoke('github_get_asset', { release });
}

export async function githubStartDownload(asset: GitHubReleaseAsset): Promise<string> {
  return invoke('github_start_download', { asset });
}

export async function githubInstallUpdate(installerPath: string): Promise<void> {
  return invoke('github_install_update', { installerPath });
}
