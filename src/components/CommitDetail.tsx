import { Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { CommitDetail as CommitDetailType } from '../lib/types';

interface CommitDetailProps {
  detail: CommitDetailType;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onNavigateCommit?: (commitId: string) => void;
  onCreatePullRequest?: (detail: CommitDetailType) => void;
}

const statusLabels: Record<string, string> = {
  added: '新增',
  modified: '修改',
  deleted: '删除',
  renamed: '重命名',
};

const statusColors: Record<string, string> = {
  added: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
};

const CommitDetail: Component<CommitDetailProps> = (props) => {
  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = createSignal<{
    x: number;
    y: number;
    phase: 'enter' | 'exit';
  } | null>(null);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, phase: 'enter' });
  };

  const closeContextMenu = () => {
    const menu = ctxMenu();
    if (!menu || menu.phase === 'exit') return;
    setCtxMenu({ ...menu, phase: 'exit' });
    setTimeout(() => setCtxMenu(null), 120);
  };

  const handleCreatePullRequest = () => {
    closeContextMenu();
    props.onCreatePullRequest?.(props.detail);
  };

  const handleCopySha = () => {
    closeContextMenu();
    navigator.clipboard.writeText(props.detail.id).catch(() => {});
  };

  // Close context menu on Escape
  createEffect(() => {
    if (!ctxMenu()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
  });

  return (
    <div class="flex flex-col h-full" onContextMenu={handleContextMenu}>
      {/* Metadata header */}
      <div class="px-4 py-3 border-b border-white/10 bg-white/5 shrink-0 space-y-1.5">
        <div class="text-sm font-semibold text-white break-words">{props.detail.message}</div>
        <div class="flex items-center gap-3 text-xs opacity-60">
          <span class="font-mono text-cyan-400">{props.detail.shortId}</span>
          <span>{props.detail.author}</span>
          <Show when={props.detail.email}>
            <span class="opacity-40">&lt;{props.detail.email}&gt;</span>
          </Show>
        </div>
        <div class="text-xs opacity-40">
          {new Date(props.detail.timestamp * 1000).toLocaleString()}
        </div>
        <Show when={props.detail.parentIds.length > 0}>
          <div class="flex items-center gap-2 text-xs">
            <span class="opacity-40">父提交:</span>
            <For each={props.detail.parentIds}>
              {(pid) => (
                <span
                  class="font-mono text-cyan-400/60 hover:text-cyan-400 cursor-pointer"
                  onClick={() => props.onNavigateCommit?.(pid)}
                >
                  {pid.substring(0, 8)}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Changed files */}
      <div class="px-3 py-2 text-xs font-semibold opacity-50 uppercase shrink-0">
        变更文件 ({props.detail.changedFiles.length})
      </div>
      <div class="flex-1 overflow-auto divide-y divide-white/5">
        <For each={props.detail.changedFiles}>
          {(file) => {
            const colorClass = statusColors[file.status] ?? 'text-white/60';
            return (
              <div
                class={`flex items-center px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${
                  props.selectedFile === file.filePath ? 'bg-white/10 border-l-2 border-l-cyan-400' : ''
                }`}
                onClick={() => props.onSelectFile(file.filePath)}
              >
                <span class={`text-xs font-mono mr-2 w-8 shrink-0 ${colorClass}`}>
                  {statusLabels[file.status] ?? file.status}
                </span>
                <span class="text-sm truncate flex-1">{file.filePath}</span>
                <Show when={file.additions > 0 || file.deletions > 0}>
                  <div class="flex items-center gap-1 ml-2 shrink-0">
                    <Show when={file.additions > 0}>
                      <span class="text-xs text-green-400">+{file.additions}</span>
                    </Show>
                    <Show when={file.deletions > 0}>
                      <span class="text-xs text-red-400">-{file.deletions}</span>
                    </Show>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      {/* Context menu */}
      <Portal>
        <Show when={ctxMenu()}>
          {(menu) => (
            <div
              class="fixed inset-0 z-50"
              onClick={closeContextMenu}
              onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
            >
              <div
                class={`fixed w-48 py-1 rounded-xl bg-white/10 backdrop-blur-2xl border border-white/10 shadow-2xl text-sm overflow-hidden ${
                  menu().phase === 'enter'
                    ? 'animate-context-menu-enter'
                    : 'animate-context-menu-exit'
                }`}
                style={{
                  left: `${menu().x}px`,
                  top: `${menu().y}px`,
                }}
              >
                <button
                  class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                  onClick={handleCreatePullRequest}
                >
                  <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  从此发起 Pull Request
                </button>
                <div class="border-t border-white/10 my-1" />
                <button
                  class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center gap-2"
                  onClick={handleCopySha}
                >
                  <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制 SHA
                </button>
              </div>
            </div>
          )}
        </Show>
      </Portal>
    </div>
  );
};

export default CommitDetail;
