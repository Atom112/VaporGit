import { Component, For, Show } from 'solid-js';
import type { FileChange } from '../lib/types';

interface CommitFileListProps {
  files: FileChange[];
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  transitionKey?: string;
}

const CommitFileList: Component<CommitFileListProps> = (props) => {
  return (
    <div class="flex flex-col h-full">
      <div class="px-3 py-2 border-b border-white/10 bg-white/5 text-sm font-semibold opacity-80 shrink-0">
        变更文件
      </div>
      <For each={[props.transitionKey ?? '']}>
        {() => (
          <div class="flex-1 overflow-auto divide-y divide-white/5 animate-content-enter">
            <For each={props.files}>
              {(file) => {
            const statusColors: Record<string, string> = {
              added: 'text-green-400',
              modified: 'text-yellow-400',
              deleted: 'text-red-400',
              renamed: 'text-blue-400',
            };
            const statusLabels: Record<string, string> = {
              added: '新增',
              modified: '修改',
              deleted: '删除',
              renamed: '重命名',
            };
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
        )}
      </For>
    </div>
  );
};

export default CommitFileList;
