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
