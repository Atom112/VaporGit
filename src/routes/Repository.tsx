import { Component, createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { repoStore } from '../stores/repoStore';
import { diffStore, setDiffStore } from '../stores/diffStore';
import { commitStore, setCommitStore } from '../stores/commitStore';
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
} from '../lib/tauriCommands';
import type { CommitInfo, CommitDetail as CommitDetailType, FileStatus } from '../lib/types';
import FileList from '../components/FileList';
import CommitDetail from '../components/CommitDetail';
import CommitGraph from '../components/CommitGraph';
import BranchList from '../components/BranchList';
import DiffView from '../components/DiffView';
import StatusBar from '../components/StatusBar';

const Repository: Component = () => {
  const navigate = useNavigate();

  // ── State ──
  const [leftTab, setLeftTab] = createSignal<'graph' | 'branches'>('graph');
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = createSignal('');
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [commitDetail, setCommitDetail] = createSignal<CommitDetailType | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = createSignal<string | null>(null);
  const [staging, setStaging] = createSignal(false);
  const [commitError, setCommitError] = createSignal<string | null>(null);
  const [commitLoading, setCommitLoading] = createSignal(false);

  // ── Resizable panels ──
  const [leftWidth, setLeftWidth] = createSignal(380);
  const [rightWidth, setRightWidth] = createSignal(320);
  const [dragging, setDragging] = createSignal<'left' | 'right' | null>(null);

  // Compute ideal left panel width to fully show commit info blocks
  function getIdealLeftWidth(): number {
    const data = commitStore.graphData;
    if (!data || data.nodes.length === 0) return 380;
    const maxLane = Math.max(...data.nodes.map((n) => n.lane), 0);
    // H_SPACE=28, MARGIN_LEFT=24, GRAPH_RIGHT_PAD=10, DASH_LEN=20,
    // INFO_GAP=6, INFO_WIDTH=340, CANVAS_EXTRA=8, PAD=4
    return (maxLane + 1) * 28 + 412;
  }

  let leftPanelAutoSized = false;

  // Auto-size left panel once when graph data first loads
  createEffect(() => {
    const data = commitStore.graphData;
    if (!data || data.nodes.length === 0 || leftPanelAutoSized) return;
    leftPanelAutoSized = true;
    setLeftWidth(Math.min(Math.max(getIdealLeftWidth(), 250), 800));
  });

  createEffect(() => {
    const handle = dragging();
    if (!handle) return;

    document.body.classList.add('select-none');

    const onMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('main-content');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      if (handle === 'left') {
        const ideal = getIdealLeftWidth();
        const minW = Math.max(200, ideal - 200);
        const maxW = ideal + 300;
        setLeftWidth(Math.max(minW, Math.min(maxW, mouseX)));
      } else {
        setRightWidth(Math.max(180, Math.min(500, rect.width - mouseX)));
      }
    };

    const onMouseUp = () => {
      setDragging(null);
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

  const refreshGraph = async () => {
    const path = repoPath();
    if (!path) return;
    setCommitStore({ graphLoading: true });
    try {
      const data = await getCommitGraph(path);
      setCommitStore({ graphData: data, graphLoading: false });
    } catch (e) {
      console.error('Failed to load commit graph:', e);
      setCommitStore({ graphLoading: false });
    }
  };

  const refreshBranches = async () => {
    const path = repoPath();
    if (!path) return;
    setCommitStore({ branchesLoading: true });
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

  onMount(() => {
    if (!repoPath()) {
      navigate('/');
      return;
    }
    refreshAll();
  });

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

  const stagedFiles = () =>
    diffStore.fileStatuses.filter((f) => f.staged);
  const unstagedFiles = () =>
    diffStore.fileStatuses.filter((f) => !f.staged);

  // ── Render ──
  return (
    <div class="h-full flex flex-col">
      {/* Main content area */}
      <div id="main-content" class="flex-1 flex overflow-hidden">
        {/* Left: Graph / Branches (resizable) */}
        <div
          class="flex flex-col bg-white/5 overflow-hidden shrink-0"
          style={{ width: `${leftWidth()}px` }}
        >
          {/* Tabs */}
          <div class="flex border-b border-white/10 shrink-0">
            <button
              class={`flex-1 py-2 text-xs font-medium transition-colors ${
                leftTab() === 'graph'
                  ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                  : 'opacity-50 hover:opacity-80'
              }`}
              onClick={() => setLeftTab('graph')}
            >
              提交图
            </button>
            <button
              class={`flex-1 py-2 text-xs font-medium transition-colors ${
                leftTab() === 'branches'
                  ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                  : 'opacity-50 hover:opacity-80'
              }`}
              onClick={() => setLeftTab('branches')}
            >
              分支
            </button>
          </div>

          {/* Tab content */}
          <Show when={leftTab() === 'graph'}>
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
                />
              </Show>
            </Show>
          </Show>

          <Show when={leftTab() === 'branches'}>
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
                  onRefresh={() => {
                    refreshBranches();
                    refreshGraph();
                    refreshStatus();
                  }}
                />
              </Show>
            </Show>
          </Show>
        </div>

        {/* Drag handle */}
        <div
          class="w-[3px] cursor-col-resize shrink-0 relative bg-white/5 hover:bg-white/15 active:bg-cyan-400/25 transition-colors"
          onMouseDown={() => setDragging('left')}
        >
          <div class="absolute inset-y-0 -left-[4px] -right-[4px]" />
        </div>

        {/* Center: Diff / Commit Detail */}
        <div class="flex-1 flex flex-col overflow-hidden bg-black/10">
          <Show
            when={
              diffStore.diffResult ||
              diffStore.diffLoading ||
              commitLoading() ||
              (selectedCommit() && commitDetail())
            }
            fallback={
              <div class="flex-1 flex items-center justify-center opacity-40 text-sm">
                选择一个提交来查看差异
              </div>
            }
          >
            <Show
              when={diffStore.diffResult || diffStore.diffLoading}
              fallback={
                <Show when={commitLoading()} fallback={
                  <Show when={commitDetail() && selectedCommit()}>
                    <CommitDetail
                      detail={commitDetail()!}
                      selectedFile={selectedCommitFile()}
                      onSelectFile={handleSelectCommitFile}
                      onNavigateCommit={handleNavigateCommit}
                    />
                  </Show>
                }>
                  <div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">
                    加载中...
                  </div>
                </Show>
              }
            >
              <DiffView
                diffResult={diffStore.diffResult ?? undefined}
                loading={diffStore.diffLoading}
                filePath={
                  diffStore.selectedFile ?? selectedCommit()?.shortId ?? ''
                }
                commitId={selectedCommit()?.id}
                repoPath={repoPath() ?? undefined}
                onBack={
                  selectedCommit() && selectedCommitFile()
                    ? () => {
                        setSelectedCommitFile(null);
                        setDiffStore({
                          selectedFile: null,
                          diffResult: null,
                          diffLoading: false,
                        });
                      }
                    : undefined
                }
              />
            </Show>
          </Show>
        </div>

        {/* Drag handle */}
        <div
          class="w-[3px] cursor-col-resize shrink-0 relative bg-white/5 hover:bg-white/15 active:bg-cyan-400/25 transition-colors"
          onMouseDown={() => setDragging('right')}
        >
          <div class="absolute inset-y-0 -left-[4px] -right-[4px]" />
        </div>

        {/* Right: File changes + commit input (resizable) */}
        <div
          class="flex flex-col bg-white/5 overflow-hidden shrink-0"
          style={{ width: `${rightWidth()}px` }}
        >
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

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default Repository;
