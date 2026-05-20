import { Component, createSignal, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { repoStore } from '../stores/repoStore';
import { diffStore, setDiffStore } from '../stores/diffStore';
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commit,
  getCommitHistory,
  getCommitDetail,
  getFileDiff,
} from '../lib/tauriCommands';
import type { CommitInfo, CommitDetail, FileStatus } from '../lib/types';
import FileList from '../components/FileList';
import CommitFileList from '../components/CommitFileList';
import DiffView from '../components/DiffView';
import StatusBar from '../components/StatusBar';

const Repository: Component = () => {
  const navigate = useNavigate();
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = createSignal('');
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [commitDetail, setCommitDetail] = createSignal<CommitDetail | null>(null);
  const [selectedCommitFile, setSelectedCommitFile] = createSignal<string | null>(null);
  const [staging, setStaging] = createSignal(false);
  const [commitError, setCommitError] = createSignal<string | null>(null);
  const [commitLoading, setCommitLoading] = createSignal(false);
  const [historyLoading, setHistoryLoading] = createSignal(false);

  // Resizable panels
  const [leftWidth, setLeftWidth] = createSignal(288);
  const [rightWidth, setRightWidth] = createSignal(320);
  const [dragging, setDragging] = createSignal<'left' | 'right' | null>(null);

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
        setLeftWidth(Math.max(180, Math.min(500, mouseX)));
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
    setHistoryLoading(true);
    try {
      const history = await getCommitHistory(path, 0, 50);
      setCommits(history);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  onMount(() => {
    if (!repoPath()) {
      navigate('/');
      return;
    }
    refreshStatus();
    refreshHistory();
  });

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
      await refreshStatus();
      await refreshHistory();
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

  const handleSelectCommit = async (commit: CommitInfo) => {
    const path = repoPath();
    if (!path) return;

    setSelectedCommit(commit);
    setSelectedCommitFile(null);
    setCommitDetail(null);
    setCommitLoading(true);
    setDiffStore({ selectedFile: null, diffResult: null, diffLoading: false });

    try {
      const detail = await getCommitDetail(path, commit.id);
      setCommitDetail(detail);
    } catch (e) {
      console.error('Failed to load commit detail:', e);
    } finally {
      setCommitLoading(false);
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

  const stagedFiles = () =>
    diffStore.fileStatuses.filter((f) => f.staged);
  const unstagedFiles = () =>
    diffStore.fileStatuses.filter((f) => !f.staged);

  return (
    <div class="h-full flex flex-col">
      {/* Main content area */}
      <div id="main-content" class="flex-1 flex overflow-hidden">
        {/* Left: Commit history (resizable) */}
        <div
          class="flex flex-col bg-white/5 overflow-hidden shrink-0"
          style={{ width: `${leftWidth()}px` }}
        >
          <div class="p-3 border-b border-white/10 text-sm font-semibold opacity-80 shrink-0">
            提交历史
          </div>
          <div class="flex-1 overflow-auto divide-y divide-white/5">
            <Show when={!historyLoading()} fallback={
              <div class="flex items-center justify-center h-full text-sm opacity-40">加载中...</div>
            }>
            <Show when={commits().length > 0} fallback={
              <div class="flex items-center justify-center h-full text-sm opacity-40">暂无提交记录</div>
            }>
            <For each={commits()}>
              {(c) => (
                <div
                  class={`p-3 cursor-pointer hover:bg-white/10 transition-colors ${
                    selectedCommit()?.id === c.id ? 'bg-white/10 border-l-2 border-l-cyan-400' : ''
                  }`}
                  onClick={() => handleSelectCommit(c)}
                >
                  <div class="text-sm font-medium truncate">{c.message}</div>
                  <div class="flex items-center gap-2 mt-1 text-xs opacity-50">
                    <span class="text-cyan-400 font-mono">{c.shortId}</span>
                    <span>{c.author}</span>
                  </div>
                  <div class="text-xs opacity-30 mt-0.5">
                    {new Date(c.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              )}
            </For>
            </Show>
            </Show>
          </div>
        </div>

        {/* Drag handle */}
        <div
          class="w-[3px] cursor-col-resize shrink-0 relative bg-white/5 hover:bg-white/15 active:bg-cyan-400/25 transition-colors"
          onMouseDown={() => setDragging('left')}
        >
          <div class="absolute inset-y-0 -left-[4px] -right-[4px]" />
        </div>

        {/* Center: Diff view */}
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
                选择一个文件或提交来查看差异
              </div>
            }
          >
            <Show
              when={
                diffStore.diffResult || diffStore.diffLoading
              }
              fallback={
                <Show when={commitLoading()} fallback={
                  <Show when={commitDetail()}>
                    <CommitFileList
                    files={commitDetail()!.changedFiles}
                    selectedFile={selectedCommitFile()}
                    onSelectFile={handleSelectCommitFile}
                    transitionKey={selectedCommit()?.id}
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