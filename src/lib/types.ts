export interface RepoInfo {
  path: string;
  headBranch: string | null;
  headCommit: string | null;
  isBare: boolean;
  isDetached: boolean;
  stateSummary: string;
}

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: string;
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  parentIds: string[];
}

export interface CommitDetail {
  id: string;
  shortId: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
  parentIds: string[];
  changedFiles: FileChange[];
}

export interface FileChange {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface FileStatus {
  path: string;
  status: StatusKind;
  staged: boolean;
}

export type StatusKind =
  | 'WT_NEW'
  | 'WT_MODIFIED'
  | 'WT_DELETED'
  | 'INDEX_NEW'
  | 'INDEX_MODIFIED'
  | 'INDEX_DELETED'
  | 'CONFLICTED'
  | 'RENAMED';

export interface DiffResult {
  filePath: string;
  oldPath: string | null;
  hunks: DiffHunk[];
  isBinary: boolean;
  isTooLarge: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
}

export type DiffLineKind = 'context' | 'addition' | 'deletion';

export interface BranchInfo {
  name: string;
  isHead: boolean;
  isRemote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  lastCommit: string | null;
}

export interface CommitGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  shortId: string;
  message: string;
  author: string;
  timestamp: number;
  branchLabels: string[];
  lane: number;
  color: number;
  row: number;
  isHead: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface RemoteInfo {
  name: string;
  url: string;
  pushUrl: string;
}

export interface ConflictEntry {
  filePath: string;
  ancestorMode: number | null;
  oursMode: number | null;
  theirsMode: number | null;
}

export interface StashInfo {
  index: number;
  message: string;
  commitId: string;
  timestamp: number;
}

// === GitHub types ===

export interface GitHubUser {
  login: string;
  id: number;
  avatarUrl: string;
  name: string | null;
  email: string | null;
  htmlUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string | null;
}

export interface AuthStatus {
  authenticated: boolean;
  user: GitHubUser | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: { login: string; id: number; avatarUrl: string };
  htmlUrl: string;
  description: string | null;
  fork: boolean;
  cloneUrl: string;
  sshUrl: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  defaultBranch: string;
  updatedAt: string;
  private: boolean;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  diffUrl: string;
  head: PRBranchRef;
  base: PRBranchRef;
  user: { login: string; id: number; avatarUrl: string };
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  merged: boolean;
  mergeable: boolean | null;
  draft: boolean;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

export interface PRBranchRef {
  label: string;
  ref: string;
  sha: string;
  repo: {
    id: number;
    name: string;
    fullName: string;
    owner: { login: string; id: number; avatarUrl: string };
    htmlUrl: string;
    cloneUrl: string;
    defaultBranch: string;
  } | null;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
}

export interface CreatePullRequest {
  title: string;
  head: string;
  base: string;
  body?: string | null;
  draft?: boolean | null;
}

export interface MergePullRequest {
  commitTitle?: string | null;
  commitMessage?: string | null;
  mergeMethod?: string | null;
}

export interface MergePullResult {
  merged: boolean;
  message: string;
  sha: string | null;
}

export interface PullRequestFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  rawUrl: string;
  patch: string | null;
}

export interface PRComment {
  id: number;
  body: string;
  path: string | null;
  position: number | null;
  commitId: string | null;
  user: { login: string; id: number; avatarUrl: string };
  createdAt: string;
  updatedAt: string;
}
