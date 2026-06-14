import { Component, createSignal, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { repoStore, setRepoStore } from '../stores/repoStore';
import { diffStore, setDiffStore } from '../stores/diffStore';
import { commitStore, setCommitStore } from '../stores/commitStore';
import { settingsStore } from '../stores/settingsStore';
import { addToast } from '../stores/toastStore';
import {
  repositoryStore,
  setRepositoryLeftMode,
  setRepositoryLeftTab,
  setRepositoryLoading,
  setRepositoryModal,
  setRepositoryRightWidth,
} from '../stores/repositoryStore';
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commit,
  amendCommit,
  getCommitHistory,
  getCommitDetail,
  getFileDiff,
  getCommitGraph,
  getBranchList,
  openRepo,
  getRecentRepos,
  removeRecentRepo,
  checkoutBranch,
  createBranch,
  deleteBranch,
  cherryPick,
  undo as undoLast,
  redo as redoLast,
  fetch as fetchRemote,
  pull as pullRemote,
  getRemotes,
  checkSubmodules,
  openTerminal,
  closeTerminal,
  discardFiles,
  searchCommitHistory,
} from '../lib/tauriCommands';
import type { CommitInfo, CommitDetail as CommitDetailType, FileStatus, RecentRepo } from '../lib/types';
import FileList from '../components/git/FileList';
import CommitDetail from '../components/git/CommitDetail';
import CommitGraph from '../components/git/CommitGraph';
import BranchList from '../components/git/BranchList';
import DiffView from '../components/git/DiffView';
import StatusBar from '../components/layout/StatusBar';
import StashPanel from '../components/git/StashPanel';
import RemoteManager from '../components/git/RemoteManager';
import ConflictResolver from '../components/git/ConflictResolver';
import PushDialog from '../components/git/PushDialog';
import PlatformPRCreateDialog from '../components/platform/PlatformPRCreateDialog';
import { githubStore } from '../stores/githubStore';
import { giteeStore } from '../stores/giteeStore';
import InteractiveRebase from '../components/git/InteractiveRebase';
import MergeDialog from '../components/git/MergeDialog';
import BranchCompareDialog from '../components/git/BranchCompareDialog';
import KeyboardShortcuts from '../components/ui/KeyboardShortcuts';
import TerminalPanel from '../components/terminal/TerminalPanel';
import { tt, ttf } from '../i18n';
import { describeError } from '../lib/gitErrorDesc';
import { parsePlatformRemote, PlatformKind } from '../lib/platformAdapter';
import RepositoryToolbar from './repository/RepositoryToolbar';
import CommitInput from './repository/CommitInput';

const Repository: Component = () => {
  // ── State ──
  const leftTab = () => repositoryStore.panels.leftTab;
  const setLeftTab = setRepositoryLeftTab;
  const leftMode = () => repositoryStore.panels.leftMode;
  const setLeftMode = setRepositoryLeftMode;
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitPage, setCommitPage] = createSignal(0);
  const COMMIT_PAGE_SIZE = 200;
  const [commitMessage, setCommitMessage] = createSignal('');
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [commitDetail, setCommitDetail] = createSignal<CommitDetailType | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = createSignal<string | null>(null);
  const [staging, setStaging] = createSignal(false);
  const [commitError, setCommitError] = createSignal<string | null>(null);
  const [commitLoading, setCommitLoading] = createSignal(false);
  const [amendMode, setAmendMode] = createSignal(false);
  const [createBranchDialog, setCreateBranchDialog] = createSignal<{ commitId: string } | null>(null);
  const [createBranchName, setCreateBranchName] = createSignal('');
  const [createBranchLoading, setCreateBranchLoading] = createSignal(false);
  const [recentRepos, setRecentRepos] = createSignal<RecentRepo[]>([]);
  const [repoError, setRepoError] = createSignal<string | null>(null);
  const [failedRepoPath, setFailedRepoPath] = createSignal<string | null>(null);
  const [repoErrorPhase, setRepoErrorPhase] = createSignal<'closed' | 'enter' | 'exit'>('closed');

  const showRepoError = (msg: string, failedPath?: string) => {
    setRepoError(msg);
    setFailedRepoPath(failedPath ?? null);
    setRepoErrorPhase('enter');
  };

  const clearRepoErrorAnimated = (afterClear?: () => void) => {
    if (repoErrorPhase() === 'closed') return;
    setRepoErrorPhase('exit');
    setTimeout(() => {
      setRepoErrorPhase('closed');
      setRepoError(null);
      setFailedRepoPath(null);
      afterClear?.();
    }, 120);
  };

  // M3: Modal & action state
  const remoteActionLoading = () => repositoryStore.loading.remoteAction;
  const setRemoteActionLoading = (loading: boolean) => setRepositoryLoading('remoteAction', loading);
  const undoLoading = () => repositoryStore.loading.undo;
  const setUndoLoading = (loading: boolean) => setRepositoryLoading('undo', loading);
  const showStashPanel = () => repositoryStore.modals.stash;
  const setShowStashPanel = (open: boolean) => setRepositoryModal('stash', open);
  const showConflictResolver = () => repositoryStore.modals.conflictResolver;
  const setShowConflictResolver = (open: boolean) => setRepositoryModal('conflictResolver', open);
  const showRebaseDialog = () => repositoryStore.modals.rebase;
  const setShowRebaseDialog = (open: boolean) => setRepositoryModal('rebase', open);
  const showMergeDialog = () => repositoryStore.modals.merge;
  const setShowMergeDialog = (open: boolean) => setRepositoryModal('merge', open);
  const showRemoteManager = () => repositoryStore.modals.remoteManager;
  const setShowRemoteManager = (open: boolean) => setRepositoryModal('remoteManager', open);
  const showBranchCompare = () => repositoryStore.modals.branchCompare;
  const setShowBranchCompare = (open: boolean) => setRepositoryModal('branchCompare', open);
  const showPushDialog = () => repositoryStore.modals.push;
  const setShowPushDialog = (open: boolean) => setRepositoryModal('push', open);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<CommitInfo[] | null>(null);
  const [searchLoading, setSearchLoading] = createSignal(false);
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // PR creation from commit detail context menu
  const [prCreateInfo, setPrCreateInfo] = createSignal<{owner: string; repo: string} | null>(null);
  const [showPRCreate, setShowPRCreate] = createSignal(false);

  // ── Resizable panels ──
  const rightWidth = () => repositoryStore.panels.rightWidth;
  const setRightWidth = setRepositoryRightWidth;
  const [dragging, setDragging] = createSignal<boolean>(false);

  createEffect(() => {
    if (!dragging()) return;

    document.body.classList.add('select-none');

    const onMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('main-content');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setRightWidth(Math.max(180, Math.min(500, rect.width - e.clientX)));
    };

    const onMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    onCleanup(() => {
      document.body.classList.remove('select-none');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    });
  });

  const repoPath = () => repoStore.repoPath;

  // ── Data loading ──
  const refreshStatus = async () => {
    const path = repoPath();
    if (!path) return;
    try {
      const statuses = await getStatus(path);
      setDiffStore({ fileStatuses: statuses });
      // Auto-detect conflicts
      const hasConflicts = statuses.some((f) => f.status === 'CONFLICTED');
      if (hasConflicts) {
        setShowConflictResolver(true);
      }
    } catch (e) {
      console.error('刷新状态失败:', e);
      addToast(ttf('repo.refreshFailed', describeError(e)), 'error');
    }
  };

  const refreshHistory = async (reset = true) => {
    const path = repoPath();
    if (!path) return;
    try {
      const page = reset ? 0 : commitPage();
      const history = await getCommitHistory(path, page, COMMIT_PAGE_SIZE);
      if (reset) {
        setCommits(history);
      } else {
        setCommits([...commits(), ...history]);
      }
      setCommitPage(reset ? 1 : page + 1);
    } catch (e) {
      console.error('加载历史失败:', e);
    }
  };

  const refreshGraph = async (silent = false) => {
    const path = repoPath();
    if (!path) return;
    if (!silent) setCommitStore({ graphLoading: true });
    try {
      const data = await getCommitGraph(path);
      setCommitStore({ graphData: data, graphLoading: false });
    } catch (e) {
      console.error('加载提交图失败:', e);
      setCommitStore({ graphLoading: false });
      if (!silent) {
        addToast(ttf('repo.graphLoadFailed', describeError(e)), 'error');
      }
    }
  };

  const refreshBranches = async (silent = false) => {
    const path = repoPath();
    if (!path) return;
    if (!silent) setCommitStore({ branchesLoading: true });
    try {
      const branches = await getBranchList(path);
      setCommitStore({ branches, branchesLoading: false });
    } catch (e) {
      console.error('加载分支列表失败:', e);
      setCommitStore({ branchesLoading: false });
      if (!silent) {
        addToast(ttf('repo.branchesLoadFailed', describeError(e)), 'error');
      }
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshStatus(), refreshHistory(), refreshGraph(true), refreshBranches(true)]);
    // Check for submodules
    const path = repoPath();
    if (path) {
      try {
        const subs = await checkSubmodules(path);
        if (subs.length > 0) {
          addToast(`检测到 ${subs.length} 个子模块：${subs.join(', ')}。请在子模块目录中单独操作。`, 'info');
        }
      } catch { /* ignore — submodule check is non-critical */ }
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (searchTimer) clearTimeout(searchTimer);

    if (!query.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    searchTimer = setTimeout(async () => {
      const path = repoPath();
      if (!path) return;
      setSearchLoading(true);
      try {
        const results = await searchCommitHistory(path, query.trim(), 0, 100);
        setSearchResults(results);
      } catch (e) {
        console.error('搜索提交失败:', e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  onMount(async () => {
    if (repoPath()) {
      refreshAll();
    } else {
      try {
        const repos = await getRecentRepos();
        setRecentRepos(repos);
      } catch {
        // No recent repos yet
      }
    }
  });

  const handleOpenRepo = async () => {
    try {
      setRepoErrorPhase('closed');
      setRepoError(null);
      setFailedRepoPath(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Git 仓库目录',
      });
      if (!selected) return;
      setRepoStore({ loading: true });
      const repoInfo = await openRepo(selected);
      setRepoStore({ repoPath: selected, repoInfo, loading: false, error: null });
      const statuses = await getStatus(selected);
      setDiffStore({ fileStatuses: statuses });
      const repos = await getRecentRepos();
      setRecentRepos(repos);
      refreshAll();
    } catch (e) {
      setRepoStore({ loading: false });
      showRepoError(describeError(e));
    }
  };

  const handleRecentClick = async (repo: RecentRepo) => {
    try {
      setRepoErrorPhase('closed');
      setRepoError(null);
      setFailedRepoPath(null);
      setRepoStore({ loading: true });
      const repoInfo = await openRepo(repo.path);
      setRepoStore({ repoPath: repo.path, repoInfo, loading: false, error: null });
      const statuses = await getStatus(repo.path);
      setDiffStore({ fileStatuses: statuses });
      const repos = await getRecentRepos();
      setRecentRepos(repos);
      refreshAll();
    } catch (e) {
      setRepoStore({ loading: false });
      showRepoError(describeError(e), repo.path);
    }
  };

  const handleRemoveFailedRepo = () => {
    const path = failedRepoPath();
    if (!path) return;
    clearRepoErrorAnimated(async () => {
      try {
        await removeRecentRepo(path);
        const repos = await getRecentRepos();
        setRecentRepos(repos);
      } catch {
        // ignore remove errors
      }
    });
  };

  // ── Handlers ──
  const handleToggleStage = async (file: FileStatus) => {
    const path = repoPath();
    if (!path || staging()) return;
    setStaging(true);
    try {
      const entry = { path: file.path, oldPath: file.oldPath };
      let updated: FileStatus[];
      if (file.staged) {
        updated = await unstageFiles(path, [entry]);
      } else {
        updated = await stageFiles(path, [entry]);
      }
      // Use the status returned by stage/unstage directly — it is the
      // authoritative result after the index write and guarantees rename
      // entries (delete+add) are paired into a single RENAMED record.
      setDiffStore({ fileStatuses: updated });
      const hasConflicts = updated.some((f) => f.status === 'CONFLICTED');
      if (hasConflicts) {
        setShowConflictResolver(true);
      }
    } catch (e) {
      console.error('暂存/取消暂存失败:', e);
      addToast(ttf('repo.stageFailed', describeError(e)), 'error');
    } finally {
      setStaging(false);
    }
  };

  const handleStageAll = async () => {
    const path = repoPath();
    if (!path || staging()) return;
    const unstaged = diffStore.fileStatuses.filter((f) => !f.staged);
    if (unstaged.length === 0) {
      addToast('没有未暂存的文件', 'info');
      return;
    }
    setStaging(true);
    try {
      const entries = unstaged.map((f) => ({ path: f.path, oldPath: f.oldPath }));
      const updated = await stageFiles(path, entries);
      setDiffStore({ fileStatuses: updated });
      const hasConflicts = updated.some((f) => f.status === 'CONFLICTED');
      if (hasConflicts) {
        setShowConflictResolver(true);
      }
      addToast(`已暂存 ${unstaged.length} 个文件`, 'success');
    } catch (e) {
      console.error('Stage all failed:', e);
      addToast(ttf('repo.stageAllFailed', describeError(e)), 'error');
    } finally {
      setStaging(false);
    }
  };

  const handleUnstageAll = async () => {
    const path = repoPath();
    if (!path || staging()) return;
    const staged = diffStore.fileStatuses.filter((f) => f.staged);
    if (staged.length === 0) return;
    setStaging(true);
    try {
      const entries = staged.map((f) => ({ path: f.path, oldPath: f.oldPath }));
      const updated = await unstageFiles(path, entries);
      setDiffStore({ fileStatuses: updated });
      const hasConflicts = updated.some((f) => f.status === 'CONFLICTED');
      if (hasConflicts) {
        setShowConflictResolver(true);
      }
    } catch (e) {
      console.error('Unstage all failed:', e);
      addToast(ttf('repo.unstageAllFailed', describeError(e)), 'error');
    } finally {
      setStaging(false);
    }
  };

  const handleDiscard = async (file: FileStatus) => {
    const path = repoPath();
    if (!path) return;
    try {
      const updated = await discardFiles(path, [file.path]);
      setDiffStore({ fileStatuses: updated });
    } catch (e) {
      addToast(`放弃更改失败: ${describeError(e)}`, 'error');
    }
  };

  const handleDiscardAll = async () => {
    const path = repoPath();
    if (!path) return;
    const unstaged = diffStore.fileStatuses.filter((f) => !f.staged);
    if (unstaged.length === 0) return;
    try {
      const paths = unstaged.map((f) => f.path);
      const updated = await discardFiles(path, paths);
      setDiffStore({ fileStatuses: updated });
      addToast(`已放弃 ${unstaged.length} 个文件的更改`, 'success');
    } catch (e) {
      addToast(`放弃更改失败: ${describeError(e)}`, 'error');
    }
  };

  const handleCommit = async () => {
    const path = repoPath();
    const message = commitMessage().trim();
    if (!path || !message) return;

    setCommitError(null);
    try {
      if (amendMode()) {
        await amendCommit(path, message);
        addToast(tt('repo.amendSuccess'), 'success');
      } else {
        await commit(path, message);
        addToast(tt('repo.commitSuccess'), 'success');
      }
      setCommitMessage('');
      setAmendMode(false);
      await refreshAll();
    } catch (e) {
      setCommitError(describeError(e));
    }
  };

  const handleSelectFile = async (filePath: string) => {
    const path = repoPath();
    if (!path) return;

    setSelectedCommit(null);
    setSelectedCommitFile(null);
    setCommitDetail(null);
    setDiffStore({ selectedFile: filePath, diffLoading: true });
    setLeftMode('diff');
    try {
      const result = await getFileDiff(path, filePath);
      setDiffStore({ diffResult: result, diffLoading: false });
    } catch (e) {
      console.error('加载文件差异失败:', e);
      setDiffStore({ diffLoading: false });
      addToast(ttf('repo.diffLoadFailed', describeError(e)), 'error');
    }
  };

  const handleSelectCommit = async (c: CommitInfo) => {
    const path = repoPath();
    if (!path) return;

    setSelectedCommit(c);
    setSelectedCommitFile(null);
    setCommitDetail(null);
    setCommitLoading(true);
    setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
    setLeftMode('detail');

    try {
      const detail = await getCommitDetail(path, c.id);
      setCommitDetail(detail);
    } catch (e) {
      console.error('加载提交详情失败:', e);
      addToast(ttf('repo.commitDetailLoadFailed', describeError(e)), 'error');
    } finally {
      setCommitLoading(false);
    }
  };

  const handleSelectGraphNode = async (nodeId: string) => {
    const path = repoPath();
    if (!path) return;

    // Find the GraphNode to set as selected
    const node = commitStore.graphData?.nodes.find((n) => n.id === nodeId) ?? null;
    setCommitStore({ selectedNode: node });

    // Find matching commit info from the loaded commit list
    const existing = commits().find((c) => c.id === nodeId);
    if (existing) {
      await handleSelectCommit(existing);
    } else {
      // Load from detail directly
      setSelectedCommit(null);
      setSelectedCommitFile(null);
      setCommitDetail(null);
      setCommitLoading(true);
      setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
      setLeftMode('detail');

      try {
        const detail = await getCommitDetail(path, nodeId);
        // Build a minimal CommitInfo to match
        setSelectedCommit({
          id: detail.id,
          shortId: detail.shortId,
          message: detail.message,
          author: detail.author,
          email: detail.email,
          timestamp: detail.timestamp,
          parentIds: detail.parentIds,
        });
        setCommitDetail(detail);
      } catch (e) {
        console.error('从图形加载提交详情失败:', e);
        addToast(ttf('repo.commitDetailLoadFailed', describeError(e)), 'error');
      } finally {
        setCommitLoading(false);
      }
    }
  };

  const handleSelectCommitFile = async (filePath: string) => {
    const path = repoPath();
    if (!path) return;

    const commit = selectedCommit();
    if (!commit) return;

    setSelectedCommitFile(filePath);
    setDiffStore({ selectedFile: filePath, diffLoading: true });
    setLeftMode('diff');

    try {
      const result = await getFileDiff(
        path,
        filePath,
        commit.parentIds.length > 0 ? commit.parentIds[0] : undefined,
        commit.id
      );
      setDiffStore({ diffResult: result, diffLoading: false });
    } catch (e) {
      console.error('加载提交文件差异失败:', e);
      setDiffStore({ diffLoading: false });
      addToast(ttf('repo.diffLoadFailed', describeError(e)), 'error');
    }
  };

  const handleNavigateCommit = async (commitId: string) => {
    // Navigate to a parent commit from CommitDetail
    // First find it in the graph
    const node = commitStore.graphData?.nodes.find((n) => n.id === commitId);
    if (node) {
      await handleSelectGraphNode(commitId);
    }
  };

  const handleBack = () => {
    const mode = leftMode();
    if (mode === 'diff') {
      if (selectedCommit()) {
        // Back from commit file diff → commit detail
        setSelectedCommitFile(null);
        setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
        setLeftMode('detail');
      } else {
        // Back from working tree diff → tree
        setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
        setLeftMode('tree');
      }
    } else if (mode === 'detail') {
      // Back from commit detail → tree
      setSelectedCommit(null);
      setSelectedCommitFile(null);
      setCommitDetail(null);
      setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
      setCommitStore({ selectedNode: null });
      setLeftMode('tree');
    }
  };

  // ── M3 Handlers ──
  const handleFetch = async () => {
    const path = repoPath();
    if (!path || remoteActionLoading()) return;
    setRemoteActionLoading(true);
    try {
      await fetchRemote(path, settingsStore.defaultRemoteName);
      addToast(tt('repo.fetchSuccess'), 'success');
      await refreshGraph(true);
    } catch (e) {
      addToast(ttf('repo.fetchFailed', describeError(e)), 'error');
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handlePull = async () => {
    const path = repoPath();
    if (!path || remoteActionLoading()) return;
    setRemoteActionLoading(true);
    try {
      const result = await pullRemote(path, settingsStore.defaultRemoteName);
      // After pull, refresh to detect conflicts
      await refreshAll();
      const statuses = diffStore.fileStatuses;
      const hasConflicts = statuses.some((f) => f.status === 'CONFLICTED');
      if (hasConflicts) {
        addToast(tt('repo.conflictPullDetected'), 'info');
        setShowConflictResolver(true);
      } else {
        addToast(result, 'success');
      }
    } catch (e) {
      addToast(ttf('repo.pullFailed', describeError(e)), 'error');
      // Also check for conflicts on error (e.g. merge conflicts returned as errors)
      await refreshStatus();
      const statuses = diffStore.fileStatuses;
      if (statuses.some((f) => f.status === 'CONFLICTED')) {
        setShowConflictResolver(true);
      }
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handleUndo = async () => {
    const path = repoPath();
    if (!path || undoLoading()) return;
    setUndoLoading(true);
    try {
      const msg = await undoLast(path);
      addToast(`已撤销提交: ${msg.slice(0, 50)}`, 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('repo.undoFailed', describeError(e)), 'error');
    } finally {
      setUndoLoading(false);
    }
  };

  const handleRedo = async () => {
    const path = repoPath();
    if (!path || undoLoading()) return;
    setUndoLoading(true);
    try {
      const msg = await redoLast(path);
      addToast(`已重做提交: ${msg.slice(0, 50)}`, 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('repo.redoFailed', describeError(e)), 'error');
    } finally {
      setUndoLoading(false);
    }
  };

  const handleStashRefresh = async () => {
    await refreshStatus();
  };

  const handleConflictRefresh = async () => {
    await refreshStatus();
  };

  const handleRebaseRefresh = async () => {
    await Promise.all([refreshHistory(), refreshGraph(), refreshBranches(true)]);
  };

  // ── PR creation from commit detail ──
  const [prCreatePlatform, setPrCreatePlatform] = createSignal<PlatformKind>('github');
  const handleCreatePullRequest = async () => {
    const path = repoPath();
    if (!path) return;
    try {
      const remotes = await getRemotes(path);
      const origin = remotes.find((r) => r.name === 'origin');
      if (!origin) {
        addToast('未找到 origin 远程仓库', 'error');
        return;
      }
      const platformRemote = parsePlatformRemote(origin.url);
      if (platformRemote) {
        setPrCreatePlatform(platformRemote.kind);
        setPrCreateInfo({ owner: platformRemote.owner, repo: platformRemote.repo });
        setShowPRCreate(true);
        return;
      }
      addToast('远程仓库不是 GitHub 或 Gitee 地址', 'error');
    } catch (e) {
      addToast(`获取远程仓库信息失败: ${describeError(e)}`, 'error');
    }
  };

  // ── Commit graph context menu handlers ──
  const handleGraphCheckout = async (commitId: string) => {
    const path = repoPath();
    if (!path) return;
    try {
      await checkoutBranch(path, commitId);
      addToast('已检出到提交 ' + commitId.slice(0, 8), 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('commit.checkoutFailed', describeError(e)), 'error');
    }
  };

  const handleGraphCreateBranch = (commitId: string) => {
    setCreateBranchDialog({ commitId });
    setCreateBranchName('');
    setCreateBranchLoading(false);
  };

  const handleCreateBranchSubmit = async () => {
    const dialog = createBranchDialog();
    if (!dialog) return;
    const path = repoPath();
    const name = createBranchName().trim();
    if (!path || !name) return;
    setCreateBranchLoading(true);
    try {
      await createBranch(path, name, dialog.commitId);
      addToast(`分支 ${name} 创建成功`, 'success');
      setCreateBranchDialog(null);
      await refreshAll();
    } catch (e) {
      addToast(ttf('commit.createBranchFailed', describeError(e)), 'error');
    } finally {
      setCreateBranchLoading(false);
    }
  };

  const handleGraphCherryPick = async (commitId: string) => {
    const path = repoPath();
    if (!path) return;
    try {
      const result = await cherryPick(path, commitId);
      addToast(result, 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('commit.cherryPickFailed', describeError(e)), 'error');
    }
  };

  const handleGraphCheckoutBranch = async (branchName: string) => {
    const path = repoPath();
    if (!path) return;
    try {
      await checkoutBranch(path, branchName);
      addToast(ttf('repo.switchBranchSuccess', branchName), 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('repo.switchBranchFailed', describeError(e)), 'error');
    }
  };

  const handleGraphDeleteBranch = async (branchName: string) => {
    const path = repoPath();
    if (!path) return;
    try {
      await deleteBranch(path, branchName);
      addToast(ttf('commit.deleteBranchSuccess', branchName), 'success');
      await refreshAll();
    } catch (e) {
      addToast(ttf('commit.deleteBranchFailed', describeError(e)), 'error');
    }
  };

  const stagedFiles = () =>
    diffStore.fileStatuses.filter((f) => f.staged);
  const unstagedFiles = () =>
    diffStore.fileStatuses.filter((f) => !f.staged);

  // ── Terminal ──
  const [terminalPhase, setTerminalPhase] = createSignal<'enter' | 'exit' | null>(null);

  const handleOpenTerminal = async () => {
    const path = repoPath();
    if (!path) return;
    // Mount TerminalPanel first so event listeners register before the process starts
    setTerminalPhase('enter');
    await new Promise((r) => setTimeout(r, 50));
    try {
      await openTerminal(path);
    } catch (e) {
      addToast(ttf('repo.terminalOpenFailed', describeError(e)), 'error');
      handleCloseTerminal();
    }
  };

  const handleCloseTerminal = () => {
    const phase = terminalPhase();
    if (!phase || phase === 'exit') return;
    setTerminalPhase('exit');
    setTimeout(() => {
      setTerminalPhase(null);
      closeTerminal().catch((e) => {
        console.warn(`关闭终端失败: ${describeError(e)}`);
      });
    }, 160);
  };

  // ── Render ──
  return (
    <div class="h-full flex flex-col">
      <Show when={repoPath()} fallback={
        <div class="flex-1 flex flex-col p-8 overflow-hidden animate-tree-enter">
          <div class="max-w-xl w-full mx-auto flex-1 flex flex-col min-h-0">
            <div class="shrink-0">
              <h1 class="text-2xl font-bold mb-6 text-center">{tt('repo.noRepoOpen')}</h1>

              <Show when={repoErrorPhase() !== 'closed'}>
                <div class={`mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm space-y-2 ${
                  repoErrorPhase() === 'enter' ? 'animate-error-enter' : 'animate-error-exit'
                }`}>
                  <p>{repoError()}</p>
                  <Show when={failedRepoPath()}>
                    <button
                      class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                      onClick={handleRemoveFailedRepo}
                    >
                      {tt('common.delete')}
                    </button>
                  </Show>
                </div>
              </Show>
            </div>

            <div
              class={`p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm mb-6 text-center shrink-0 ${
                repoStore.loading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={handleOpenRepo}
            >
              <h2 class="text-lg font-bold mb-1">{tt('home.openRepo')}</h2>
              <p class="opacity-70 text-sm">{tt('home.openDesc')}</p>
              <Show when={repoStore.loading}>
                <div class="mt-2 text-xs text-cyan-400">{tt('common.loading')}</div>
              </Show>
            </div>

            <Show when={recentRepos().length > 0}>
              <div class="flex-1 flex flex-col min-h-0">
                <h2 class="text-sm font-semibold mb-3 opacity-60 uppercase tracking-wider text-center shrink-0">{tt('home.recentRepos')}</h2>
                <div class="overflow-y-auto min-h-0 space-y-2 pr-1">
                <For each={recentRepos()}>
                  {(repo) => (
                    <div
                      class={`p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center gap-2 ${
                        repoStore.loading ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      onClick={() => handleRecentClick(repo)}
                    >
                      <div class="flex-1 min-w-0 overflow-hidden">
                        <span class="font-medium">{repo.name}</span>
                        <span class="text-xs opacity-50 block truncate">{repo.path}</span>
                      </div>
                      <span class="text-xs opacity-40 shrink-0 whitespace-nowrap">{repo.lastOpened}</span>
                      <button
                        class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-xs text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await removeRecentRepo(repo.path);
                            const repos = await getRecentRepos();
                            setRecentRepos(repos);
                          } catch { /* ignore */ }
                        }}
                        title={tt('common.delete')}
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      }>
        {/* Main content area */}
        <div id="main-content" class="flex-1 flex overflow-hidden animate-tree-enter">
        {/* Left: switches between tree/detail/diff */}
        <div class="flex-1 flex flex-col bg-white/5 overflow-hidden">
          {/* Back bar (detail/diff mode) */}
          <Show when={leftMode() !== 'tree'}>
            <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
              <button
                class="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={handleBack}
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
{tt('repo.back')}
              </button>
              <Show when={leftMode() === 'detail'}>
                <span class="text-xs opacity-40">{tt('repo.commitDetail')}</span>
              </Show>
            </div>
          </Show>

          {/* Tree: Tabs + CommitGraph / BranchList */}
          <Show when={leftMode() === 'tree'}>
            <div class="flex flex-col h-full overflow-hidden animate-tree-enter min-h-0">
              {/* Tabs */}
              <div class="flex items-center border-b border-white/10 shrink-0">
                <button
                  class="flex items-center gap-1 px-3 py-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
                  onClick={async () => {
                    setSelectedCommit(null);
                    setSelectedCommitFile(null);
                    setCommitDetail(null);
                    setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });
                    setCommitStore({ selectedNode: null, graphData: null, branches: [] });
                    setLeftMode('tree');
                    setRepoStore({ repoPath: null, repoInfo: null });
                    try {
                      const repos = await getRecentRepos();
                      setRecentRepos(repos);
                    } catch {
                      // 无最近打开的仓库
                    }
                  }}
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
  {tt('repo.back')}
                </button>
                <button
                  class={`flex-1 py-2 text-xs font-medium transition-colors ${
                    leftTab() === 'graph'
                      ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setLeftTab('graph')}
                >
                  {tt('repo.commitGraph')}
                </button>
                <button
                  class={`flex-1 py-2 text-xs font-medium transition-colors ${
                    leftTab() === 'branches'
                      ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setLeftTab('branches')}
                >
                  {tt('repo.branches')}
                </button>
              </div>

              {/* Tab content */}
              <Show when={leftTab() === 'graph'}>
                <div class="flex-1 min-h-0 animate-content-enter flex flex-col">
                  {/* Search bar */}
                  <div class="shrink-0 px-3 py-2 border-b border-white/10">
                    <div class="relative">
                      <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                        placeholder={tt('repo.searchCommitsPlaceholder')}
                        value={searchQuery()}
                        onInput={(e) => handleSearch(e.currentTarget.value)}
                      />
                      <Show when={searchLoading()}>
                        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-cyan-400/50 border-t-transparent rounded-full animate-spin" />
                      </Show>
                    </div>
                  </div>
                  <Show
                    when={!searchResults()}
                    fallback={
                      <div class="flex-1 flex flex-col min-h-0">
                        <div class="shrink-0 px-3 py-1.5 text-xs text-white/50">
                          {ttf('repo.searchResults', searchResults()!.length)}
                        </div>
                        <div class="flex-1 overflow-y-auto">
                          <For each={searchResults()}>
                            {(c) => (
                              <div
                                class="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
                                onClick={() => handleSelectCommit(c)}
                              >
                                <span class="font-mono text-cyan-400/70 shrink-0">{c.shortId}</span>
                                <span class="truncate flex-1">{c.message}</span>
                                <span class="text-white/40 shrink-0 text-[10px]">{c.author}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    }
                  >
                  <Show
                    when={!commitStore.graphLoading}
                    fallback={
                      <div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('common.loading')}</div>
                    }
                  >
                    <Show
                      when={commitStore.graphData && commitStore.graphData.nodes.length > 0}
                      fallback={
                        <div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('repo.noCommits')}</div>
                      }
                    >
                      <div id="commit-graph-area" class="flex flex-col h-full">
                        <CommitGraph
                          graphData={commitStore.graphData!}
                          selectedNodeId={commitStore.selectedNode?.id}
                          onSelectNode={handleSelectGraphNode}
                          repoPath={repoPath() ?? undefined}
                          onCheckout={handleGraphCheckout}
                          onCreateBranch={handleGraphCreateBranch}
                          onCherryPick={handleGraphCherryPick}
                          onCreatePullRequest={handleCreatePullRequest}
                          onCheckoutBranch={handleGraphCheckoutBranch}
                          onDeleteBranch={handleGraphDeleteBranch}
                        />
                        <Show when={commitStore.graphData?.truncated}>
                          <div class="shrink-0 px-3 py-1.5 text-xs text-yellow-400/70 bg-yellow-400/5 border-t border-yellow-400/10 text-center">
                            {tt('repo.graphTruncated')}
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </Show>
                </Show>
              </div>
            </Show>

            <Show when={leftTab() === 'branches'}>
                <div class="flex-1 min-h-0 animate-content-enter">
                  <Show
                    when={!commitStore.branchesLoading}
                    fallback={
                      <div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('common.loading')}</div>
                    }
                  >
                    <Show
                      when={commitStore.branches.length > 0}
                      fallback={
                        <div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('repo.noBranches')}</div>
                      }
                    >
                      <BranchList
                        branches={commitStore.branches}
                        repoPath={repoPath()!}
                        onRefresh={async () => {
                          await Promise.all([
                            refreshBranches(true),
                            refreshGraph(true),
                            refreshStatus(),
                          ]);
                        }}
                      />
                    </Show>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>

          {/* Detail: Commit Detail */}
          <Show when={leftMode() === 'detail'}>
            <div class="flex-1 flex flex-col animate-content-enter">
              <Show
                when={!commitLoading()}
                fallback={
                  <div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">
                    {tt('common.loading')}
                  </div>
                }
              >
                <Show when={commitDetail() && selectedCommit()}>
                  <CommitDetail
                    detail={commitDetail()!}
                    selectedFile={selectedCommitFile()}
                    onSelectFile={handleSelectCommitFile}
                    onNavigateCommit={handleNavigateCommit}
                  />
                </Show>
              </Show>
            </div>
          </Show>

          {/* Diff: File diff view */}
          <Show when={leftMode() === 'diff'}>
            <div class="flex-1 flex flex-col min-h-0 overflow-hidden animate-content-enter">
              <Show
                when={diffStore.diffResult || diffStore.diffLoading}
                fallback={
                  <div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">
                    {tt('repo.noDiff')}
                  </div>
                }
              >
                <DiffView
                  diffResult={diffStore.diffResult ?? undefined}
                  loading={diffStore.diffLoading}
                  filePath={diffStore.selectedFile ?? selectedCommit()?.shortId ?? ''}
                  commitId={selectedCommit()?.id}
                  repoPath={repoPath() ?? undefined}
                />
              </Show>
            </div>
          </Show>
        </div>

        {/* Drag handle */}
        <div
          class="w-0.75 cursor-col-resize shrink-0 relative bg-white/5 hover:bg-white/15 active:bg-cyan-400/25 transition-colors"
          onMouseDown={() => setDragging(true)}
        >
          <div class="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right: File changes + commit input (resizable) */}
        <div
          class="flex flex-col bg-white/5 overflow-hidden shrink-0"
          style={{ width: `${rightWidth()}px` }}
        >
          <RepositoryToolbar
            remoteActionLoading={remoteActionLoading()}
            undoLoading={undoLoading()}
            githubAuthenticated={githubStore.authenticated}
            giteeAuthenticated={giteeStore.authenticated}
            onFetch={handleFetch}
            onPull={handlePull}
            onPush={() => setShowPushDialog(true)}
            onRemoteManager={() => setShowRemoteManager(true)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onStash={() => setShowStashPanel(true)}
            onMerge={() => setShowMergeDialog(true)}
            onRebase={() => setShowRebaseDialog(true)}
            onBranchCompare={() => setShowBranchCompare(true)}
          />

          <CommitInput
            message={commitMessage()}
            amendMode={amendMode()}
            stagedCount={stagedFiles().length}
            error={commitError()}
            onMessageChange={setCommitMessage}
            onAmendModeChange={setAmendMode}
            onCommit={handleCommit}
          />

          {/* File list */}
          <div id="file-list-area" class="flex-1 overflow-auto">
            <FileList
              stagedFiles={stagedFiles()}
              unstagedFiles={unstagedFiles()}
              selectedFile={diffStore.selectedFile ?? undefined}
              onToggleStage={handleToggleStage}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              onSelectFile={handleSelectFile}
              onDiscard={handleDiscard}
              onDiscardAll={handleDiscardAll}
            />
          </div>

          {/* Terminal toggle */}
          <div class="p-2 border-t border-white/10 shrink-0">
            <button
              class="w-full py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5"
              onClick={handleOpenTerminal}
            >
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {tt('repo.terminal')}
            </button>
          </div>
        </div>
      </div>
    </Show>

      {/* Terminal panel */}
      <TerminalPanel phase={terminalPhase()} onClose={handleCloseTerminal} />

      {/* M3 Modals */}
      <Show when={showStashPanel() && repoPath()}>
        <StashPanel
          repoPath={repoPath()!}
          onClose={() => setShowStashPanel(false)}
          onRefresh={handleStashRefresh}
        />
      </Show>

      <Show when={showRemoteManager() && repoPath()}>
        <RemoteManager
          repoPath={repoPath()!}
          onClose={() => setShowRemoteManager(false)}
          onRefresh={refreshStatus}
        />
      </Show>

      <Show when={showConflictResolver() && repoPath()}>
        <ConflictResolver
          repoPath={repoPath()!}
          onClose={() => setShowConflictResolver(false)}
          onRefresh={handleConflictRefresh}
        />
      </Show>

      <Show when={showRebaseDialog() && repoPath()}>
        <InteractiveRebase
          repoPath={repoPath()!}
          onClose={() => setShowRebaseDialog(false)}
          onRefresh={handleRebaseRefresh}
        />
      </Show>

      <Show when={showMergeDialog() && repoPath()}>
        <MergeDialog
          repoPath={repoPath()!}
          onClose={() => setShowMergeDialog(false)}
          onRefresh={refreshAll}
        />
      </Show>

      <Show when={showBranchCompare() && repoPath()}>
        <BranchCompareDialog
          repoPath={repoPath()!}
          onClose={() => setShowBranchCompare(false)}
        />
      </Show>

      <Show when={showPushDialog() && repoPath()}>
        <PushDialog
          repoPath={repoPath()!}
          onClose={() => setShowPushDialog(false)}
          onRefresh={refreshAll}
        />
      </Show>

      {/* PR Create Dialog */}
      <Show
        when={
          showPRCreate() &&
          prCreateInfo() &&
          ((prCreatePlatform() === 'github' && githubStore.authenticated) ||
            (prCreatePlatform() === 'gitee' && giteeStore.authenticated))
        }
      >
        <PlatformPRCreateDialog
          kind={prCreatePlatform()}
          owner={prCreateInfo()!.owner}
          repo={prCreateInfo()!.repo}
          defaultBase="main"
          onClose={() => setShowPRCreate(false)}
          onCreated={() => {
            setShowPRCreate(false);
            addToast(tt('pr.createdGeneric'), 'success');
          }}
        />
      </Show>

      {/* Create branch from commit dialog */}
      <Show when={createBranchDialog()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div class="w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter">
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 class="text-sm font-bold">{tt('commit.createBranchFrom')}</h2>
              <button
                class="text-xs opacity-50 hover:text-red-400 transition-colors"
                onClick={() => setCreateBranchDialog(null)}
              >
                {tt('common.close')}
              </button>
            </div>
            <div class="p-4 space-y-3">
              <div>
                <label class="block text-xs font-medium mb-1 opacity-70">{tt('repo.branchName')}</label>
                <input
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                  placeholder={tt('repo.branchNamePlaceholder')}
                  value={createBranchName()}
                  onInput={(e) => setCreateBranchName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBranchSubmit()}
                  disabled={createBranchLoading()}
                  autofocus
                />
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors"
                  onClick={() => setCreateBranchDialog(null)}
                  disabled={createBranchLoading()}
                >
                  {tt('common.cancel')}
                </button>
                <button
                  class="flex-1 py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-xs font-medium transition-colors"
                  onClick={handleCreateBranchSubmit}
                  disabled={!createBranchName().trim() || createBranchLoading()}
                >
                  {createBranchLoading() ? tt('repo.creatingBranch') : tt('common.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Keyboard shortcuts */}
      <KeyboardShortcuts
        disabled={!repoPath()}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={() => setShowPushDialog(true)}
        onCommit={handleCommit}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onStash={() => setShowStashPanel(true)}
        onRebase={() => setShowRebaseDialog(true)}
        onStageAll={handleStageAll}
        onUnstageAll={handleUnstageAll}
        onBack={handleBack}
        onRefresh={refreshAll}
        onBranchTab={() => setLeftTab('branches')}
      />

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default Repository;
