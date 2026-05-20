import { Component, Show } from 'solid-js';
import { repoStore } from '../stores/repoStore';

const StatusBar: Component = () => {
  const branch = () => repoStore.repoInfo?.headBranch;
  const headCommit = () => repoStore.repoInfo?.headCommit;
  const state = () => repoStore.repoInfo?.stateSummary;

  return (
    <div class="h-7 flex items-center justify-between px-3 text-xs bg-white/5 border-t border-white/10 shrink-0 select-none">
      <div class="flex items-center gap-4 opacity-70">
        <Show when={branch()} fallback={<span class="opacity-40">无仓库</span>}>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="font-semibold">{branch()}</span>
          </span>
        </Show>
        <Show when={headCommit()}>
          <span class="font-mono opacity-50">{(headCommit() ?? '').substring(0, 7)}</span>
        </Show>
        <Show when={state() && state() !== 'Clean'}>
          <span class="text-yellow-400">{state()}</span>
        </Show>
      </div>
      <div class="opacity-50">
        <Show when={repoStore.repoPath} fallback={<span>未打开仓库</span>}>
          <span class="font-mono text-[10px]">{repoStore.repoPath}</span>
        </Show>
      </div>
    </div>
  );
};

export default StatusBar;
