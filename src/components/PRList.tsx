import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { githubListPulls } from '../lib/tauriCommands';
import type { GitHubPullRequest } from '../lib/types';

interface Props {
  owner: string;
  repo: string;
  onSelect: (pr: GitHubPullRequest) => void;
  onCreateNew: () => void;
}

const PRList: Component<Props> = (props) => {
  const [state, setState] = createSignal<'open' | 'closed'>('open');
  const [page, setPage] = createSignal(1);

  const [pulls] = createResource(
    () => ({ state: state(), page: page() }),
    async ({ state: s, page: p }) => {
      return githubListPulls(props.owner, props.repo, s, p, 30);
    }
  );

  const stateColor = (pr: GitHubPullRequest) => {
    if (pr.merged) return 'text-purple-400';
    if (pr.state === 'closed') return 'text-red-400';
    return 'text-green-400';
  };

  const stateIcon = (pr: GitHubPullRequest) => {
    if (pr.merged) {
      return (
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm-.28 1.47a.75.75 0 010 1.06l-2.22 2.22h10.5a.75.75 0 010 1.5H2.5l2.22 2.22a.75.75 0 11-1.06 1.06l-3.5-3.5a.75.75 0 010-1.06l3.5-3.5a.75.75 0 011.06 0z" />
        </svg>
      );
    }
    if (pr.state === 'closed') {
      return (
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.28 4.22L4.22 11.28a.75.75 0 001.06 1.06l7.06-7.06a.75.75 0 00-1.06-1.06z" />
          <path d="M4.22 4.22a.75.75 0 011.06 0l7.06 7.06a.75.75 0 01-1.06 1.06L4.22 5.28a.75.75 0 010-1.06z" />
        </svg>
      );
    }
    return (
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354z" />
        <path d="M3.75 0a.75.75 0 00-.75.75v7.5c0 .414.336.75.75.75h6.5a.75.75 0 00.75-.75v-1.5a.75.75 0 00-1.5 0V7.5H4.5V1.5h3.75a.75.75 0 000-1.5H3.75z" />
      </svg>
    );
  };

  return (
    <div class="space-y-2">
      {/* State tabs */}
      <div class="flex gap-1 border-b border-white/10 pb-2">
        <button
          class={`px-3 py-1 text-xs rounded-lg transition-colors ${
            state() === 'open' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => { setState('open'); setPage(1); }}
        >
          Open
        </button>
        <button
          class={`px-3 py-1 text-xs rounded-lg transition-colors ${
            state() === 'closed' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => { setState('closed'); setPage(1); }}
        >
          Closed
        </button>
        <div class="flex-1" />
        <button
          onClick={props.onCreateNew}
          class="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          New PR
        </button>
      </div>

      {/* Loading */}
      <Show when={pulls.loading}>
        <div class="flex items-center justify-center py-8">
          <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">加载 PR 列表...</span>
        </div>
      </Show>

      {/* Error */}
      <Show when={pulls.error}>
        <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
          加载失败: {String(pulls.error)}
        </div>
      </Show>

      {/* Empty */}
      <Show when={!pulls.loading && !pulls.error && pulls()?.length === 0}>
        <div class="text-center py-8 text-sm text-gray-500">暂无 Pull Request</div>
      </Show>

      {/* PR list */}
      <div class="space-y-1">
        <For each={pulls()}>
          {(pr) => (
            <div
              class="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] cursor-pointer transition-colors"
              onClick={() => props.onSelect(pr)}
            >
              <span class={stateColor(pr)}>
                {stateIcon(pr)}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-white font-medium truncate">{pr.title}</span>
                  {pr.draft && (
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 shrink-0">Draft</span>
                  )}
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>#{pr.number}</span>
                  <span>by {pr.user.login}</span>
                  <Show when={pr.merged}><span class="text-purple-400">Merged</span></Show>
                </div>
              </div>
              <div class="text-xs text-gray-500 shrink-0">
                {pr.additions > 0 && <span class="text-green-400">+{pr.additions}</span>}
                {pr.deletions > 0 && <span class="text-red-400 ml-1">-{pr.deletions}</span>}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Pagination */}
      <Show when={pulls() && pulls()!.length >= 30}>
        <div class="flex justify-center gap-2 pt-1">
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={page() <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </button>
          <span class="px-2 py-1 text-xs text-gray-400">第 {page()} 页</span>
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={pulls() && pulls()!.length < 30}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </Show>
    </div>
  );
};

export default PRList;
