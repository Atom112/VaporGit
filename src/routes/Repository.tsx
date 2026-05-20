import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { repoStore } from '../stores/repoStore';
import { diffStore, setDiffStore } from '../stores/diffStore';
import {
  getStatus,
  stageFiles,
  unstageFiles,
  commit,
  getCommitHistory,
  getFileDiff,
} from '../lib/tauriCommands';
import type { CommitInfo, FileStatus } from '../lib/types';
import FileList from '../components/FileList';
import DiffView from '../components/DiffView';
import StatusBar from '../components/StatusBar';

const Repository: Component = () => {
  const navigate = useNavigate();
  const [commits, setCommits] = createSignal<CommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = createSignal('');
  const [selectedCommit, setSelectedCommit] = createSignal<CommitInfo | null>(null);
  const [staging, setStaging] = createSignal(false);
  const [commitError, setCommitError] = createSignal<string | null>(null);

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
    try {
      const history = await getCommitHistory(path, 0, 50);
      setCommits(history);
    } catch (e) {
      console.error('Failed to load history:', e);
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
    setDiffStore({ selectedFile: null, diffLoading: true });

    try {
      if (commit.parentIds.length > 0) {
        const result = await getFileDiff(
          path,
          '.',
          commit.parentIds[0],
          commit.id
        );
        setDiffStore({ diffResult: result, diffLoading: false });
      }
    } catch (e) {
      console.error('Failed to load commit diff:', e);
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
      <div class="flex-1 flex overflow-hidden">
        {/* Left: File list + Commit area */}
        <div class="w-80 flex flex-col border-r border-white/10 bg-white/5 overflow-hidden">
          {/* Commit input */}
          <div class="p-3 border-b border-white/10">
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

        {/* Right: Diff view */}
        <div class="flex-1 flex flex-col overflow-hidden bg-black/10">
          <Show
            when={diffStore.diffResult || diffStore.diffLoading}
            fallback={
              <div class="flex-1 flex items-center justify-center opacity-40 text-sm">
                选择一个文件或提交来查看差异
              </div>
            }
          >
            <DiffView
              diffResult={diffStore.diffResult ?? undefined}
              loading={diffStore.diffLoading}
              filePath={
                diffStore.selectedFile ?? selectedCommit()?.shortId ?? ''
              }
            />
          </Show>
        </div>

        {/* Right sidebar: Commit history */}
        <div class="w-72 border-l border-white/10 bg-white/5 overflow-auto shrink-0">
          <div class="p-3 border-b border-white/10 text-sm font-semibold opacity-80">
            提交历史
          </div>
          <div class="divide-y divide-white/5">
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
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default Repository;