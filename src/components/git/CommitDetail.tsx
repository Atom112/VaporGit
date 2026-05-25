import { Component, For, Show } from 'solid-js';
import type { CommitDetail as CommitDetailType } from '../../lib/types';

interface CommitDetailProps {
  detail: CommitDetailType;
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  onNavigateCommit?: (commitId: string) => void;
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
  return (
    <div class="flex flex-col h-full">
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
    </div>
  );
};

export default CommitDetail;
