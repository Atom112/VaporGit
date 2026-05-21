import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { githubListRepos } from '../lib/tauriCommands';
import { githubStore, cacheRepos } from '../stores/githubStore';
import type { GitHubRepo } from '../lib/types';

interface Props {
  onClone: (url: string) => void;
}

const LANGUAGES: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Python: '#3572a5',
  Go: '#00add8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  Ruby: '#701516',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
};

const GitHubRepoList: Component<Props> = (props) => {
  const [search, setSearch] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [repos, setRepos] = createSignal<GitHubRepo[]>(githubStore.reposCache ?? []);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const fetchRepos = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await githubListRepos(p, 50);
      setRepos(list);
      if (p === 1) cacheRepos(list); // persist page 1 across routes
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount if cache missing; re-fetch on page change
  createEffect(() => {
    const p = page();
    if (p === 1 && githubStore.reposCache) return;
    fetchRepos(p);
  });

  const filtered = () => {
    const q = search().toLowerCase();
    if (!q) return repos();
    return repos()?.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q))
    );
  };

  return (
    <div class="space-y-3">
      {/* Search bar */}
      <input
        class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
        placeholder="搜索仓库..."
        value={search()}
        onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
      />

      {/* Loading state */}
      <Show when={loading() && !error()}>
        <div class="flex items-center justify-center py-8">
          <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">加载仓库列表...</span>
        </div>
      </Show>

      {/* Error state */}
      <Show when={error()}>
        <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
          加载失败: {error()}
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!loading() && !error() && filtered()?.length === 0}>
        <div class="text-center py-8 text-sm text-gray-500">
          {search() ? '没有匹配的仓库' : '暂无仓库'}
        </div>
      </Show>

      {/* Repo list */}
      <div class="space-y-2 max-h-96 overflow-y-auto">
        <For each={filtered()}>
          {(repo) => (
            <RepoCard repo={repo} onClone={props.onClone} />
          )}
        </For>
      </div>

      {/* Pagination */}
      <Show when={repos().length >= 50}>
        <div class="flex justify-center gap-2 pt-2">
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={page() <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span class="px-2 py-1 text-xs text-gray-400">第 {page()} 页</span>
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={repos().length < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </Show>
    </div>
  );
};

const RepoCard: Component<{ repo: GitHubRepo; onClone: (url: string) => void }> = (props) => {
  const r = () => props.repo;
  const timeAgo = () => {
    const d = new Date(r().updatedAt);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    const months = Math.floor(days / 30);
    return `${months} 个月前`;
  };

  return (
    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-white truncate">{r().fullName}</span>
            {r().fork && (
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 shrink-0">fork</span>
            )}
            {r().private && (
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">private</span>
            )}
          </div>
          <Show when={r().description}>
            <p class="text-xs text-gray-400 mt-0.5 line-clamp-1">{r().description}</p>
          </Show>
          <div class="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
            <Show when={r().language}>
              <span class="flex items-center gap-1">
                <span
                  class="w-2.5 h-2.5 rounded-full"
                  style={{ background: LANGUAGES[r().language!] ?? '#8b8b8b' }}
                />
                {r().language}
              </span>
            </Show>
            <span class="flex items-center gap-0.5">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              {r().stargazersCount}
            </span>
            <span>更新于 {timeAgo()}</span>
          </div>
        </div>
        <button
          onClick={() => props.onClone(r().cloneUrl)}
          class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          克隆
        </button>
      </div>
    </div>
  );
};

export default GitHubRepoList;
