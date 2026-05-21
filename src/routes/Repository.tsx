import { Component, createSignal, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { repoStore, setRepoStore } from '../stores/repoStore';
import { diffStore, setDiffStore } from '../stores/diffStore';
import { commitStore, setCommitStore } from '../stores/commitStore';
import { settingsStore } from '../stores/settingsStore';
import { addToast } from '../stores/toastStore';
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commit,
  getCommitHistory,
  getCommitDetail,
  getFileDiff,
  getCommitGraph,
  getBranchList,
  openRepo,
  getRecentRepos,
  checkoutBranch,
  createBranch,
  cherryPick,
  fetch as fetchRemote,
  pull as pullRemote,
  push as pushRemote,
} from '../lib/tauriCommands';
import type { CommitInfo, CommitDetail as CommitDetailType, FileStatus, RecentRepo } from '../lib/types';
import FileList from '../components/FileList';
import CommitDetail from '../components/CommitDetail';
import CommitGraph from '../components/CommitGraph';
import BranchList from '../components/BranchList';
import DiffView from '../components/DiffView';
import StatusBar from '../components/StatusBar';
import StashPanel from '../components/StashPanel';
import ConflictResolver from '../components/ConflictResolver';
import InteractiveRebase from '../components/InteractiveRebase';

const Repository: Component = () => {
  // ── State ──
  const [leftTab, setLeftTab] = createSignal<'graph' | 'branches'>('graph');
  const [leftMode, setLeftMode] = createSignal<'tree' | 'detail' | 'diff'>('tree');
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = createSignal('');
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [commitDetail, setCommitDetail] = createSignal<CommitDetailType | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = createSignal<string | null>(null);
  const [staging, setStaging] = createSignal(false);
  const [commitError, setCommitError] = createSignal<string | null>(null);
  const [commitLoading, setCommitLoading] = createSignal(false);
  const [recentRepos, setRecentRepos] = createSignal<RecentRepo[]>([]);
  const [repoError, setRepoError] = createSignal<string | null>(null);

  // M3: Modal & action state
  const [remoteActionLoading, setRemoteActionLoading] = createSignal(false);
  const [showStashPanel, setShowStashPanel] = createSignal(false);
  const [showConflictResolver, setShowConflictResolver] = createSignal(false);
  const [showRebaseDialog, setShowRebaseDialog] = createSignal(false);

  // ── Resizable panels ──
  const [rightWidth, setRightWidth] = createSignal(420);
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
      console.error('Failed to refresh status:', e);
    }
  };

  const refreshHistory = async () => {
    const path = repoPath();
    if (!path) return;
    try {
      const history = await getCommitHistory(path, 0, 50);
      setCommits(history);
    } catch (e) {
      console.error('Failed to load history:', e);
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
      console.error('Failed to load commit graph:', e);
      setCommitStore({ graphLoading: false });
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
      console.error('Failed to load branches:', e);
      setCommitStore({ branchesLoading: false });
    }
  };

  const refreshAll = async () => {
    await Promise.all([refreshStatus(), refreshHistory(), refreshGraph(), refreshBranches()]);
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
      setRepoError(null);
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
      setRepoError(String(e));
    }
  };

  const handleRecentClick = async (repo: RecentRepo) => {
    try {
      setRepoError(null);
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
      setRepoError(String(e));
    }
  };

  // ── Handlers ──
  const handleToggleStage = async (file: FileStatus) => {
    const path = repoPath();
    if (!path || staging()) return;
    setStaging(true);
    try {
      if (file.staged) {
        await unstageFiles(path, [file.path]);
      } else {
        await stageFiles(path, [file.path]);
      }
      await refreshStatus();
    } catch (e) {
      console.error('Stage/unstage failed:', e);
    } finally {
      setStaging(false);
    }
  };

  const handleStageAll = async () => {
    const path = repoPath();
    if (!path || staging()) return;
    const unstaged = diffStore.fileStatuses.filter((f) => !f.staged);
    if (unstaged.length === 0) return;
    setStaging(true);
    try {
      await stageFiles(
        path,
        unstaged.map((f) => f.path)
      );
      await refreshStatus();
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
      await unstageFiles(
        path,
        staged.map((f) => f.path)
      );
      await refreshStatus();
    } finally {
      setStaging(false);
    }
  };

  const handleCommit = async () => {
    const path = repoPath();
    const message = commitMessage().trim();
    if (!path || !message) return;

    setCommitError(null);
    try {
      await commit(path, message);
      addToast('提交成功', 'success');
      setCommitMessage('');
      await refreshAll();
    } catch (e) {
      setCommitError(String(e));
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
      console.error('Failed to load diff:', e);
      setDiffStore({ diffLoading: false });
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
      console.error('Failed to load commit detail:', e);
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
        console.error('Failed to load commit detail from graph:', e);
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
      console.error('Failed to load commit file diff:', e);
      setDiffStore({ diffLoading: false });
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
      addToast('Fetch 完成', 'success');
      await refreshGraph(true);
    } catch (e) {
      addToast(`Fetch 失败: ${e}`, 'error');
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
      addToast(result, 'success');
      await refreshAll();
    } catch (e) {
      addToast(`Pull 失败: ${e}`, 'error');
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handlePush = async () => {
    const path = repoPath();
    if (!path || remoteActionLoading()) return;
    setRemoteActionLoading(true);
    try {
      await pushRemote(path, settingsStore.defaultRemoteName);
      addToast('Push 完成', 'success');
      await refreshGraph(true);
    } catch (e) {
      addToast(`Push 失败: ${e}`, 'error');
    } finally {
      setRemoteActionLoading(false);
    }
  };

  const handleStashRefresh = async () => {
    await Promise.all([refreshStatus()]);
  };

  const handleConflictRefresh = async () => {
    await refreshStatus();
  };

  const handleRebaseRefresh = async () => {
    await Promise.all([refreshHistory(), refreshGraph(), refreshBranches(true)]);
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
      addToast(`检出失败: ${e}`, 'error');
    }
  };

  const handleGraphCreateBranch = async (commitId: string) => {
    const path = repoPath();
    if (!path) return;
    const name = prompt('请输入新分支名称:');
    if (!name || !name.trim()) return;
    try {
      await createBranch(path, name.trim(), commitId);
      addToast(`分支 ${name.trim()} 创建成功`, 'success');
      await refreshAll();
    } catch (e) {
      addToast(`创建分支失败: ${e}`, 'error');
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
      addToast(`Cherry-pick 失败: ${e}`, 'error');
    }
  };

  const stagedFiles = () =>
    diffStore.fileStatuses.filter((f) => f.staged);
  const unstagedFiles = () =>
    diffStore.fileStatuses.filter((f) => !f.staged);

  // ── Render ──
  return (
    <div class="h-full flex flex-col">
      <Show when={repoPath()} fallback={
        <div class="flex-1 flex flex-col items-center justify-center p-8 overflow-auto animate-tree-enter">
          <div class="max-w-xl w-full">
            <h1 class="text-2xl font-bold mb-6 text-center">选择仓库</h1>

            <Show when={repoError()}>
              <div class="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
                {repoError()}
              </div>
            </Show>

            <div
              class={`p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm mb-6 text-center ${
                repoStore.loading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={handleOpenRepo}
            >
              <h2 class="text-lg font-bold mb-1">打开仓库</h2>
              <p class="opacity-70 text-sm">浏览本地文件夹并打开一个 Git 仓库</p>
              <Show when={repoStore.loading}>
                <div class="mt-2 text-xs text-cyan-400">正在加载...</div>
              </Show>
            </div>

            <Show when={recentRepos().length > 0}>
              <h2 class="text-sm font-semibold mb-3 opacity-60 uppercase tracking-wider text-center">最近打开的仓库</h2>
              <div class="space-y-2">
                <For each={recentRepos()}>
                  {(repo) => (
                    <div
                      class={`p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-between ${
                        repoStore.loading ? 'opacity-50 pointer-events-none' : ''
                      }`}
                      onClick={() => handleRecentClick(repo)}
                    >
                      <div>
                        <span class="font-medium">{repo.name}</span>
                        <span class="ml-3 text-xs opacity-50">{repo.path}</span>
                      </div>
                      <span class="text-xs opacity-40">{repo.lastOpened}</span>
                    </div>
                  )}
                </For>
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
                返回
              </button>
              <Show when={leftMode() === 'detail'}>
                <span class="text-xs opacity-40">提交详情</span>
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
                  返回
                </button>
                <button
                  class={`flex-1 py-2 text-xs font-medium transition-colors ${
                    leftTab() === 'graph'
                      ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setLeftTab('graph')}
                >
                  提交记录
                </button>
                <button
                  class={`flex-1 py-2 text-xs font-medium transition-colors ${
                    leftTab() === 'branches'
                      ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setLeftTab('branches')}
                >
                  选择分支（checkout）
                </button>
              </div>

              {/* Tab content */}
              <Show when={leftTab() === 'graph'}>
                <div class="flex-1 min-h-0 animate-content-enter">
                  <Show
                    when={!commitStore.graphLoading}
                    fallback={
                      <div class="flex-1 flex items-center justify-center text-sm opacity-40">加载中...</div>
                    }
                  >
                    <Show
                      when={commitStore.graphData && commitStore.graphData.nodes.length > 0}
                      fallback={
                        <div class="flex-1 flex items-center justify-center text-sm opacity-40">暂无提交记录</div>
                      }
                    >
                      <CommitGraph
                        graphData={commitStore.graphData!}
                        selectedNodeId={commitStore.selectedNode?.id}
                        onSelectNode={handleSelectGraphNode}
                        repoPath={repoPath() ?? undefined}
                        onCheckout={handleGraphCheckout}
                        onCreateBranch={handleGraphCreateBranch}
                        onCherryPick={handleGraphCherryPick}
                      />
                    </Show>
                  </Show>
                </div>
              </Show>

              <Show when={leftTab() === 'branches'}>
                <div class="flex-1 min-h-0 animate-content-enter">
                  <Show
                    when={!commitStore.branchesLoading}
                    fallback={
                      <div class="flex-1 flex items-center justify-center text-sm opacity-40">加载中...</div>
                    }
                  >
                    <Show
                      when={commitStore.branches.length > 0}
                      fallback={
                        <div class="flex-1 flex items-center justify-center text-sm opacity-40">无分支</div>
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
                    加载中...
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
            <div class="flex-1 flex flex-col animate-content-enter">
              <Show
                when={diffStore.diffResult || diffStore.diffLoading}
                fallback={
                  <div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">
                    无差异内容
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
          {/* Remote toolbar */}
          <div class="px-3 py-2 border-b border-white/10 shrink-0 space-y-1.5">
            <div class="flex gap-1.5">
              <button
                class="flex-1 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                onClick={handleFetch}
                disabled={remoteActionLoading()}
              >
                {remoteActionLoading() ? '...' : 'Fetch'}
              </button>
              <button
                class="flex-1 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                onClick={handlePull}
                disabled={remoteActionLoading()}
              >
                {remoteActionLoading() ? '...' : 'Pull'}
              </button>
              <button
                class="flex-1 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                onClick={handlePush}
                disabled={remoteActionLoading()}
              >
                {remoteActionLoading() ? '...' : 'Push'}
              </button>
            </div>
            <div class="flex gap-1.5">
              <button
                class="flex-1 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={() => setShowStashPanel(true)}
              >
                Stash
              </button>
              <button
                class="flex-1 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={() => setShowRebaseDialog(true)}
              >
                Rebase
              </button>
            </div>
          </div>

          {/* Commit input */}
          <div class="p-3 border-b border-white/10 shrink-0">
            <textarea
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              rows={3}
              placeholder="输入提交信息..."
              value={commitMessage()}
              onInput={(e) => setCommitMessage(e.currentTarget.value)}
            />
            <div class="flex gap-2 mt-2">
              <button
                class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                onClick={handleCommit}
                disabled={!commitMessage().trim() || stagedFiles().length === 0}
              >
                提交
              </button>
            </div>
            {commitError() && (
              <div class="mt-2 text-xs text-red-400">{commitError()}</div>
            )}
          </div>

          {/* File list */}
          <div class="flex-1 overflow-auto">
            <FileList
              stagedFiles={stagedFiles()}
              unstagedFiles={unstagedFiles()}
              selectedFile={diffStore.selectedFile ?? undefined}
              onToggleStage={handleToggleStage}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
              onSelectFile={handleSelectFile}
            />
          </div>
        </div>
      </div>
    </Show>

      {/* M3 Modals */}
      <Show when={showStashPanel() && repoPath()}>
        <StashPanel
          repoPath={repoPath()!}
          onClose={() => setShowStashPanel(false)}
          onRefresh={handleStashRefresh}
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

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default Repository;
