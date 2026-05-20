import { Component, For, Show } from 'solid-js';
import type { DiffResult } from '../lib/types';

interface DiffViewProps {
  diffResult?: DiffResult;
  loading: boolean;
  filePath: string;
}

const DiffView: Component<DiffViewProps> = (props) => {
  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
        <span class="text-sm font-mono opacity-80 truncate">{props.filePath}</span>
      </div>

      {/* Diff content */}
      <div class="flex-1 overflow-auto font-mono text-sm">
        <Show when={!props.loading} fallback={
          <div class="flex items-center justify-center h-full opacity-40">加载中...</div>
        }>
          <Show
            when={props.diffResult && !props.diffResult.isBinary && !props.diffResult.isTooLarge}
            fallback={
              <div class="flex items-center justify-center h-full opacity-40 text-sm">
                {props.diffResult?.isBinary
                  ? '二进制文件，无法显示差异'
                  : props.diffResult?.isTooLarge
                  ? '文件过大，无法显示完整差异'
                  : '无差异内容'}
              </div>
            }
          >
            <For each={props.diffResult?.hunks ?? []}>
              {(hunk) => (
                <div class="border-b border-white/5">
                  <div class="bg-white/5 px-3 py-1 text-xs text-cyan-400 font-semibold">
                    {hunk.header}
                  </div>
                  <For each={hunk.lines}>
                    {(line) => {
                      let bgClass = '';
                      let prefix = ' ';
                      if (line.kind === 'addition') {
                        bgClass = 'bg-green-500/10';
                        prefix = '+';
                      } else if (line.kind === 'deletion') {
                        bgClass = 'bg-red-500/10';
                        prefix = '-';
                      }
                      return (
                        <div class={`flex px-3 py-0 ${bgClass}`}>
                          <span
                            class={`w-5 shrink-0 select-none text-right mr-2 ${
                              line.kind === 'addition'
                                ? 'text-green-400'
                                : line.kind === 'deletion'
                                ? 'text-red-400'
                                : 'opacity-30'
                            }`}
                          >
                            {prefix}
                          </span>
                          <span class="whitespace-pre-wrap break-all">{line.content}</span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default DiffView;
