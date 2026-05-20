import { Component, For, Show } from 'solid-js';
import type { FileStatus } from '../lib/types';

interface FileListProps {
  stagedFiles: FileStatus[];
  unstagedFiles: FileStatus[];
  selectedFile?: string;
  onToggleStage: (file: FileStatus) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onSelectFile: (path: string) => void;
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
  return (
    <div class="flex flex-col h-full">
      {/* Staged files */}
      <Show when={props.stagedFiles.length > 0}>
        <div class="border-b border-white/10">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              已暂存 ({props.stagedFiles.length})
            </span>
            <button
              class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              onClick={props.onUnstageAll}
            >
              全部取消暂存
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
                  class={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-white/10 cursor-pointer hover:bg-white/20 ${statusColor(
                    file.status
                  )}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleStage(file);
                  }}
                  title="点击取消暂存"
                >
                  {statusLabel(file.status)}
                </span>
                <span class="truncate flex-1">{file.path}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Unstaged files */}
      <Show when={props.unstagedFiles.length > 0}>
        <div class="flex-1">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              变更 ({props.unstagedFiles.length})
            </span>
            <button
              class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              onClick={props.onStageAll}
            >
              全部暂存
            </button>
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
                  class={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-white/10 cursor-pointer hover:bg-white/20 ${statusColor(
                    file.status
                  )}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleStage(file);
                  }}
                  title="点击暂存"
                >
                  {statusLabel(file.status)}
                </span>
                <span class="truncate flex-1">{file.path}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.stagedFiles.length === 0 && props.unstagedFiles.length === 0}>
        <div class="flex-1 flex items-center justify-center p-4 text-sm opacity-40">
          工作区干净，没有变更
        </div>
      </Show>
    </div>
  );
};

export default FileList;
