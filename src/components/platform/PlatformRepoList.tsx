import { Component, For, Show, createEffect, createSignal } from 'solid-js';
import { describeError } from '../../lib/gitErrorDesc';
import { getPlatformAdapter, PlatformKind, PlatformRepo } from '../../lib/platformAdapter';
import { tt, ttf } from '../../i18n';

interface PlatformRepoListProps {
  kind: PlatformKind;
  initialRepos: PlatformRepo[] | null;
  onCache: (repos: PlatformRepo[]) => void;
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

const PlatformRepoList: Component<PlatformRepoListProps> = (props) => {
  const [search, setSearch] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [repos, setRepos] = createSignal<PlatformRepo[]>(props.initialRepos ?? []);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const fetchRepos = async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await getPlatformAdapter(props.kind).listRepos(nextPage, 50);
      setRepos(list);
      if (nextPage === 1) props.onCache(list);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const nextPage = page();
    if (nextPage === 1 && props.initialRepos) return;
    fetchRepos(nextPage);
  });

  const filtered = () => {
    const query = search().toLowerCase();
    if (!query) return repos();
    return repos().filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query),
    );
  };

  return (
    <div class="space-y-3 flex flex-col min-h-0">
      <input
        class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30 shrink-0"
        placeholder={tt(`${props.kind}.searchRepos`)}
        value={search()}
        onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
      />

      <Show when={loading() && !error()}>
        <div class="flex items-center justify-center py-8 shrink-0" role="status">
          <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">{tt(`${props.kind}.loadingRepos`)}</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm shrink-0">
          {tt('pr.loadFailed')}: {error()}
        </div>
      </Show>

      <Show when={!loading() && !error() && filtered().length === 0}>
        <div class="text-center py-8 text-sm text-gray-500 shrink-0">
          {search() ? tt(`${props.kind}.noMatchRepos`) : tt(`${props.kind}.noRepos`)}
        </div>
      </Show>

      <div class="space-y-2 flex-1 overflow-y-auto min-h-0">
        <For each={filtered()}>
          {(repo) => (
            <RepoCard kind={props.kind} repo={repo} onClone={props.onClone} />
          )}
        </For>
      </div>

      <Show when={repos().length >= 50}>
        <div class="flex justify-center gap-2 pt-2 shrink-0">
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={page() <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {tt(`${props.kind}.prevPage`)}
          </button>
          <span class="px-2 py-1 text-xs text-gray-400">{ttf(`${props.kind}.page`, page())}</span>
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={repos().length < 50}
            onClick={() => setPage((current) => current + 1)}
          >
            {tt(`${props.kind}.nextPage`)}
          </button>
        </div>
      </Show>
    </div>
  );
};

const RepoCard: Component<{
  kind: PlatformKind;
  repo: PlatformRepo;
  onClone: (url: string) => void;
}> = (props) => {
  const timeAgo = () => {
    const date = new Date(props.repo.updatedAt);
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return tt(`${props.kind}.justNow`);
    if (hours < 24) return ttf(`${props.kind}.hoursAgo`, hours);
    const days = Math.floor(hours / 24);
    if (days < 30) return ttf(`${props.kind}.daysAgo`, days);
    const months = Math.floor(days / 30);
    return ttf(`${props.kind}.monthsAgo`, months);
  };

  return (
    <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-white truncate">{props.repo.fullName}</span>
            <Show when={props.repo.fork}>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 shrink-0">fork</span>
            </Show>
            <Show when={props.repo.private} fallback={
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0">public</span>
            }>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0">private</span>
            </Show>
          </div>
          <Show when={props.repo.description}>
            <p class="text-xs text-gray-400 mt-0.5 line-clamp-1">{props.repo.description}</p>
          </Show>
          <div class="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
            <Show when={props.repo.language}>
              <span class="flex items-center gap-1">
                <span
                  class="w-2.5 h-2.5 rounded-full"
                  style={{ background: LANGUAGES[props.repo.language!] ?? '#8b8b8b' }}
                />
                {props.repo.language}
              </span>
            </Show>
            <span class="flex items-center gap-0.5">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              {props.repo.stargazersCount}
            </span>
            <span class="flex items-center gap-0.5">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {props.repo.forksCount}
            </span>
            <span>{tt(`${props.kind}.updatedAt`)} {timeAgo()}</span>
          </div>
        </div>
        <button
          onClick={() => props.onClone(props.repo.cloneUrl)}
          class="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          {tt(`${props.kind}.clone`)}
        </button>
      </div>
    </div>
  );
};

export default PlatformRepoList;
