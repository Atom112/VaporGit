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
  BranchDiffSummary,
  RemoteInfo,
  ConflictEntry,
  ConflictBlockDetail,
  BlockResolution,
  StashInfo,
  RebaseEntry,
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
  GiteeUser,
  GiteeAuthStatus,
  GiteeRepo,
  GiteeBranch,
  GiteePullRequest,
  GiteePullRequestFile,
  GiteePRComment,
  GiteeMergePullResult,
  TagInfo,
  BlameLine,
  ReflogEntry,
  LfsOperationResult,
  SshConnectionResult,
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

interface StageEntry {
  path: string;
  oldPath?: string;
}

export async function stageFiles(path: string, files: StageEntry[]): Promise<FileStatus[]> {
  return invoke('stage_files', { path, files });
}

export async function unstageFiles(path: string, files: StageEntry[]): Promise<FileStatus[]> {
  return invoke('unstage_files', { path, files });
}

export async function commit(path: string, message: string): Promise<CommitInfo> {
  return invoke('commit', { path, message });
}

export async function amendCommit(path: string, message: string): Promise<CommitInfo> {
  return invoke('amend_commit', { path, message });
}

export async function getCommitHistory(
  path: string,
  page: number,
  pageSize: number
): Promise<CommitInfo[]> {
  return invoke('get_commit_history', { path, page, pageSize });
}

export async function searchCommitHistory(
  path: string,
  query: string,
  page: number,
  pageSize: number
): Promise<CommitInfo[]> {
  return invoke('search_commit_history', { path, query, page, pageSize });
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

export async function stageHunk(path: string, filePath: string, hunkIndex: number): Promise<void> {
  return invoke('stage_hunk', { path, filePath, hunkIndex });
}

export async function stageLine(path: string, filePath: string, hunkIndex: number, lineIndex: number): Promise<void> {
  return invoke('stage_line', { path, filePath, hunkIndex, lineIndex });
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

export async function compareBranches(
  path: string,
  baseBranch: string,
  targetBranch: string
): Promise<BranchDiffSummary> {
  return invoke('compare_branches', { path, baseBranch, targetBranch });
}

export async function checkoutRemoteBranch(path: string, name: string): Promise<void> {
  return invoke('checkout_remote_branch', { path, name });
}

export async function deleteBranch(path: string, name: string): Promise<void> {
  return invoke('delete_branch', { path, name });
}

export async function deleteRemoteBranch(path: string, remoteName: string, branchName: string): Promise<void> {
  return invoke('delete_remote_branch', { path, remoteName, branchName });
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

export async function pushWithAutoCreate(
  path: string,
  remote?: string,
  branch?: string
): Promise<string> {
  return invoke('push_with_auto_create', { path, remote: remote ?? null, branch: branch ?? null });
}

export async function getRemotes(path: string): Promise<RemoteInfo[]> {
  return invoke('get_remotes', { path });
}

export async function addRemote(path: string, name: string, url: string): Promise<void> {
  return invoke('add_remote', { path, name, url });
}

export async function setRemoteUrl(path: string, name: string, url: string): Promise<void> {
  return invoke('set_remote_url', { path, name, url });
}

export async function deleteRemote(path: string, name: string): Promise<void> {
  return invoke('delete_remote', { path, name });
}

export async function checkSubmodules(path: string): Promise<string[]> {
  return invoke('check_submodules', { path });
}

export async function getConflicts(path: string): Promise<ConflictEntry[]> {
  return invoke('get_conflicts', { path });
}

export async function getConflictContent(path: string, file: string, stage: string): Promise<string> {
  return invoke('get_conflict_content', { path, file, stage });
}

export async function discardFiles(path: string, files: string[]): Promise<FileStatus[]> {
  return invoke('discard_files', { path, files });
}

export async function resolveConflict(path: string, file: string, resolution: string): Promise<void> {
  return invoke('resolve_conflict', { path, file, resolution });
}

export async function getConflictBlocks(path: string, file: string): Promise<ConflictBlockDetail[]> {
  return invoke('get_conflict_blocks', { path, file });
}

export async function resolveConflictBlocks(path: string, file: string, resolutions: BlockResolution[]): Promise<void> {
  return invoke('resolve_conflict_blocks', { path, file, resolutions });
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

export async function mergeBranch(path: string, branchName: string, strategy: string): Promise<string> {
  return invoke('merge_branch', { path, branchName, strategy });
}

export async function rebase(path: string, onto: string): Promise<string> {
  return invoke('rebase', { path, onto });
}

export async function listRebaseCommits(path: string, ontoBranch: string): Promise<RebaseEntry[]> {
  return invoke('list_rebase_commits', { path, ontoBranch });
}

export async function performInteractiveRebase(path: string, ontoBranch: string, entries: RebaseEntry[]): Promise<string> {
  return invoke('perform_interactive_rebase', { path, ontoBranch, entries });
}

export async function cherryPick(path: string, commitId: string): Promise<string> {
  return invoke('cherry_pick', { path, commitId });
}

export async function openTerminal(path: string): Promise<void> {
  return invoke('open_terminal', { path });
}

export async function writeTerminal(data: string): Promise<void> {
  return invoke('write_terminal', { data });
}

export async function resizeTerminal(cols: number, rows: number): Promise<void> {
  return invoke('resize_terminal', { cols, rows });
}

export async function closeTerminal(): Promise<void> {
  return invoke('close_terminal');
}

export async function revertCommit(path: string, commitId: string): Promise<string> {
  return invoke('revert_commit', { path, commitId });
}

export async function createTag(path: string, commitId: string, tagName: string): Promise<string> {
  return invoke('create_tag', { path, commitId, tagName });
}

export async function listTags(path: string): Promise<TagInfo[]> {
  return invoke('list_tags', { path });
}

export async function deleteTag(path: string, tagName: string): Promise<string> {
  return invoke('delete_tag', { path, tagName });
}

export async function submoduleAdd(
  path: string,
  url: string,
  submodulePath: string,
): Promise<string> {
  return invoke('submodule_add', { path, url, submodulePath });
}

export async function submoduleInit(path: string): Promise<string> {
  return invoke('submodule_init', { path });
}

export async function submoduleUpdate(path: string, recursive = true): Promise<string> {
  return invoke('submodule_update', { path, recursive });
}

export async function gitBlame(path: string, filePath: string): Promise<BlameLine[]> {
  return invoke('git_blame', { path, filePath });
}

export async function getReflog(path: string, reference?: string): Promise<ReflogEntry[]> {
  return invoke('get_reflog', { path, reference: reference ?? null });
}

export async function lfsPull(path: string): Promise<LfsOperationResult> {
  return invoke('lfs_pull', { path });
}

export async function lfsTrack(path: string, pattern: string): Promise<LfsOperationResult> {
  return invoke('lfs_track', { path, pattern });
}

export async function lfsUntrack(path: string, pattern: string): Promise<LfsOperationResult> {
  return invoke('lfs_untrack', { path, pattern });
}

export async function testSshConnection(
  host: string,
  keyPath?: string,
): Promise<SshConnectionResult> {
  return invoke('test_ssh_connection', { host, keyPath: keyPath ?? null });
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

// === Gitee ===

export async function giteeLogin(): Promise<GiteeUser> {
  return invoke('gitee_login');
}

export async function giteeCheckAuth(): Promise<GiteeAuthStatus> {
  return invoke('gitee_check_auth');
}

export async function giteeLogout(): Promise<void> {
  return invoke('gitee_logout');
}

export async function giteeGetUser(): Promise<GiteeUser> {
  return invoke('gitee_get_user');
}

export async function giteeListRepos(page?: number, perPage?: number): Promise<GiteeRepo[]> {
  return invoke('gitee_list_repos', { page: page ?? null, perPage: perPage ?? null });
}

export async function giteeGetRepo(owner: string, repo: string): Promise<GiteeRepo> {
  return invoke('gitee_get_repo', { owner, repo });
}

export async function giteeCreateRepo(name: string, description: string | null, private_: boolean): Promise<GiteeRepo> {
  return invoke('gitee_create_repo', { name, description, private: private_ });
}

export async function giteeListBranches(owner: string, repo: string): Promise<GiteeBranch[]> {
  return invoke('gitee_list_branches', { owner, repo });
}

export async function giteeListPulls(
  owner: string,
  repo: string,
  state?: string,
  page?: number,
  perPage?: number
): Promise<GiteePullRequest[]> {
  return invoke('gitee_list_pulls', {
    owner,
    repo,
    state: state ?? null,
    page: page ?? null,
    perPage: perPage ?? null,
  });
}

export async function giteeGetPull(owner: string, repo: string, number: number): Promise<GiteePullRequest> {
  return invoke('gitee_get_pull', { owner, repo, number });
}

export async function giteeCreatePull(
  owner: string,
  repo: string,
  request: { title: string; head: string; base: string; body?: string | null; draft?: boolean | null }
): Promise<GiteePullRequest> {
  return invoke('gitee_create_pull', { owner, repo, request });
}

export async function giteeMergePull(
  owner: string,
  repo: string,
  number: number,
  request: { mergeMethod?: string | null }
): Promise<GiteeMergePullResult> {
  return invoke('gitee_merge_pull', { owner, repo, number, request });
}

export async function giteeGetPullFiles(
  owner: string,
  repo: string,
  number: number
): Promise<GiteePullRequestFile[]> {
  return invoke('gitee_get_pull_files', { owner, repo, number });
}

export async function giteeGetPullDiff(owner: string, repo: string, number: number): Promise<string> {
  return invoke('gitee_get_pull_diff', { owner, repo, number });
}

export async function giteeListPullComments(
  owner: string,
  repo: string,
  number: number
): Promise<GiteePRComment[]> {
  return invoke('gitee_list_pull_comments', { owner, repo, number });
}

// === Tutorial ===

export async function createDemoRepo(): Promise<string> {
  return invoke('create_demo_repo');
}

export async function deleteDir(path: string): Promise<void> {
  return invoke('delete_dir', { path });
}
