import { Component, createSignal, For, Show } from 'solid-js';
import type { FileStatus } from '../../lib/types';
import { tt, ttf } from '../../i18n';

interface FileListProps {
  stagedFiles: FileStatus[];
  unstagedFiles: FileStatus[];
  selectedFile?: string;
  onToggleStage: (file: FileStatus) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onSelectFile: (path: string) => void;
  onDiscard?: (file: FileStatus) => void;
  onDiscardAll?: () => void;
}

const statusLabel = (status: FileStatus['status']): string => {
  switch (status) {
    case 'WT_NEW':
      return 'U';
    case 'WT_MODIFIED':
      return 'M';
    case 'WT_DELETED':
      return 'D';
    case 'INDEX_NEW':
      return 'A';
    case 'INDEX_MODIFIED':
      return 'M';
    case 'INDEX_DELETED':
      return 'D';
    case 'CONFLICTED':
      return '!';
    case 'RENAMED':
      return 'R';
    default:
      return '?';
  }
};

const statusColor = (status: FileStatus['status']): string => {
  switch (status) {
    case 'WT_NEW':
    case 'INDEX_NEW':
      return 'text-green-400';
    case 'WT_MODIFIED':
    case 'INDEX_MODIFIED':
      return 'text-yellow-400';
    case 'WT_DELETED':
    case 'INDEX_DELETED':
      return 'text-red-400';
    case 'CONFLICTED':
      return 'text-orange-400';
    case 'RENAMED':
      return 'text-purple-400';
    default:
      return 'text-white/60';
  }
};

const FileList: Component<FileListProps> = (props) => {
  // Discard confirmation dialog state
  const [discardTarget, setDiscardTarget] = createSignal<{ type: 'file'; file: FileStatus } | { type: 'all' } | null>(null);
  const [discardPhase, setDiscardPhase] = createSignal<'enter' | 'exit' | null>(null);

  const openDiscardConfirm = (target: { type: 'file'; file: FileStatus } | { type: 'all' }) => {
    setDiscardTarget(target);
    setDiscardPhase('enter');
  };

  const closeDiscardConfirm = () => {
    if (discardPhase() === 'exit') return;
    setDiscardPhase('exit');
    setTimeout(() => {
      setDiscardPhase(null);
      setDiscardTarget(null);
    }, 120);
  };

  const handleDiscardConfirm = () => {
    const target = discardTarget();
    if (!target) return;
    if (target.type === 'file') {
      props.onDiscard?.(target.file);
    } else {
      props.onDiscardAll?.();
    }
    closeDiscardConfirm();
  };

  return (
    <div class="flex flex-col h-full">
      {/* Unstaged files (top) */}
      <Show when={props.unstagedFiles.length > 0}>
        <div class={props.stagedFiles.length > 0 ? 'border-b border-white/10' : ''}>
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              {ttf('repo.changedCount', props.unstagedFiles.length)}
            </span>
            <div class="flex gap-2">
              <Show when={props.onDiscardAll}>
                <button
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                  onClick={() => openDiscardConfirm({ type: 'all' })}
                >
                  {tt('repo.discardAll')}
                </button>
              </Show>
              <button
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={props.onStageAll}
              >
                {tt('repo.stageAll')}
              </button>
            </div>
          </div>
          <For each={props.unstagedFiles}>
            {(file) => (
              <div
                class={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors text-sm ${
                  props.selectedFile === file.path ? 'bg-white/10' : ''
                }`}
                onClick={() => props.onSelectFile(file.path)}
              >
                <span
                  class={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-white/10 ${statusColor(
                    file.status
                  )}`}
                >
                  {statusLabel(file.status)}
                </span>
                <span class="truncate flex-1" title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
                  <Show when={file.oldPath}>
                    <span class="opacity-50 line-through mr-1">{file.oldPath}</span>
                    <span class="opacity-40 mx-0.5">→</span>
                  </Show>
                  {file.path}
                </span>
                <div class="flex gap-1 shrink-0">
                  <Show when={props.onDiscard}>
                    <button
                      class="text-[11px] px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDiscardConfirm({ type: 'file', file });
                      }}
                    >
                      {tt('repo.discard')}
                    </button>
                  </Show>
                  <button
                    class="text-[11px] px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onToggleStage(file);
                    }}
                  >
                    {tt('repo.stage')}
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Staged files (bottom) */}
      <Show when={props.stagedFiles.length > 0}>
        <div class="flex-1">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              {ttf('repo.stagedCount', props.stagedFiles.length)}
            </span>
            <button
              class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              onClick={props.onUnstageAll}
            >
              {tt('repo.unstageAll')}
            </button>
          </div>
          <For each={props.stagedFiles}>
            {(file) => (
              <div
                class={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors text-sm ${
                  props.selectedFile === file.path ? 'bg-white/10' : ''
                }`}
                onClick={() => props.onSelectFile(file.path)}
              >
                <span
                  class={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-white/10 ${statusColor(
                    file.status
                  )}`}
                >
                  {statusLabel(file.status)}
                </span>
                <span class="truncate flex-1" title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
                  <Show when={file.oldPath}>
                    <span class="opacity-50 line-through mr-1">{file.oldPath}</span>
                    <span class="opacity-40 mx-0.5">→</span>
                  </Show>
                  {file.path}
                </span>
                <button
                  class="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleStage(file);
                  }}
                >
                  {tt('repo.unstage')}
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.stagedFiles.length === 0 && props.unstagedFiles.length === 0}>
        <div class="flex-1 flex items-center justify-center p-4 text-sm opacity-40">
          {tt('repo.clean')}
        </div>
      </Show>

      {/* Discard confirmation dialog */}
      <Show when={discardPhase() && discardTarget()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div class={`w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
            discardPhase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
          }`}>
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 class="text-sm font-bold text-red-400">{tt('repo.discard')}</h2>
              <button
                class="text-xs opacity-50 hover:text-red-400 transition-colors"
                onClick={closeDiscardConfirm}
              >
                {tt('common.close')}
              </button>
            </div>
            <div class="p-4 space-y-4">
              <Show when={discardTarget()?.type === 'file'} fallback={
                <p class="text-sm">{ttf('repo.discardAllConfirm', props.unstagedFiles.length)}</p>
              }>
                <p class="text-sm">
                  {ttf('repo.discardConfirm', (discardTarget() as any)?.file?.path ?? '')}
                </p>
              </Show>
              <div class="flex gap-2 justify-end">
                <button
                  class="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
                  onClick={closeDiscardConfirm}
                >
                  {tt('common.cancel')}
                </button>
                <button
                  class="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium transition-colors"
                  onClick={handleDiscardConfirm}
                >
                  {tt('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default FileList;