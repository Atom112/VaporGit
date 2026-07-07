import { Component, For, Resource, Show, createResource, createSignal } from 'solid-js';
import { describeError } from '../../lib/gitErrorDesc';
import { getPlatformAdapter, PlatformKind, PlatformPullRequest } from '../../lib/platformAdapter';
import { tt, ttf } from '../../i18n';

interface PlatformPRListProps {
  kind: PlatformKind;
  owner: string;
  repo: string;
  onSelect: (pr: PlatformPullRequest) => void;
  onCreateNew: () => void;
}

const PR_LIST_TIMEOUT = 20000;
const PAGE_SIZE = 30;

async function fetchPulls(
  kind: PlatformKind,
  owner: string,
  repo: string,
  state: 'open' | 'closed',
  page: number,
): Promise<PlatformPullRequest[]> {
  const adapter = getPlatformAdapter(kind);
  return Promise.race([
    adapter.listPRs(owner, repo, state, page, PAGE_SIZE),
    new Promise<PlatformPullRequest[]>((_, reject) =>
      setTimeout(() => reject(new Error(tt('pr.fetchTimeout'))), PR_LIST_TIMEOUT),
    ),
  ]);
}

const PullStateIcon: Component<{ pr: PlatformPullRequest }> = (props) => {
  const merged = () => props.pr.mergedAt !== null;
  return (
    <svg class="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <Show
        when={merged()}
        fallback={
          <Show
            when={props.pr.state === 'closed'}
            fallback={<path d="M5 3.25a3.25 3.25 0 1 1 4 3.16v3.18a3.25 3.25 0 1 1-1.5 0V6.41A3.25 3.25 0 0 1 5 3.25Zm3.25-1.75a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Zm0 9.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" />}
          >
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </Show>
        }
      >
        <path d="M2.5 2.75A2.75 2.75 0 0 1 5.25 0h.5a.75.75 0 0 1 0 1.5h-.5a1.25 1.25 0 0 0 0 2.5h2a2.75 2.75 0 0 1 2.75 2.75v2.84a3.25 3.25 0 1 1-1.5 0V6.75A1.25 1.25 0 0 0 7.25 5.5h-2A2.75 2.75 0 0 1 2.5 2.75Zm7.25 8.25a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z" />
      </Show>
    </svg>
  );
};

const PlatformPRList: Component<PlatformPRListProps> = (props) => {
  const [state, setState] = createSignal<'open' | 'closed'>('open');
  const [openPage, setOpenPage] = createSignal(1);
  const [closedPage, setClosedPage] = createSignal(1);

  const [openPulls, { refetch: refetchOpen }] = createResource(
    () => [props.kind, props.owner, props.repo, openPage()] as const,
    ([kind, owner, repo, page]) => fetchPulls(kind, owner, repo, 'open', page),
  );

  const [closedPulls, { refetch: refetchClosed }] = createResource(
    () => [props.kind, props.owner, props.repo, closedPage()] as const,
    ([kind, owner, repo, page]) => fetchPulls(kind, owner, repo, 'closed', page),
  );

  const currentPage = () => (state() === 'open' ? openPage() : closedPage());
  const currentPulls = () => (state() === 'open' ? openPulls : closedPulls);

  const handleRefresh = () => {
    refetchOpen();
    refetchClosed();
  };

  const isMerged = (pr: PlatformPullRequest) => pr.mergedAt !== null;
  const stateColor = (pr: PlatformPullRequest) => {
    if (isMerged(pr)) return 'text-purple-400';
    if (pr.state === 'closed') return 'text-red-400';
    return 'text-green-400';
  };

  const ListContent = (pulls: Resource<PlatformPullRequest[]>) => (
    <>
      <Show when={pulls.loading}>
        <div class="flex items-center justify-center py-8" role="status">
          <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">{tt('pr.loading')}</span>
        </div>
      </Show>

      <Show when={pulls.error}>
        <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
          {tt('pr.loadFailed')}: {describeError(pulls.error)}
        </div>
      </Show>

      <Show when={!pulls.loading && !pulls.error && pulls()?.length === 0}>
        <div class="text-center py-8 text-sm text-gray-500">{tt('pr.empty')}</div>
      </Show>

      <div class="space-y-1">
        <For each={pulls()}>
          {(pr) => (
            <button
              type="button"
              class="w-full flex items-start gap-2 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/6 cursor-pointer transition-colors text-left"
              onClick={() => props.onSelect(pr)}
            >
              <span class={stateColor(pr)}>
                <PullStateIcon pr={pr} />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-white font-medium truncate">{pr.title}</span>
                  <Show when={pr.draft}>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 shrink-0">Draft</span>
                  </Show>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
                  <span>#{pr.number}</span>
                  <span>by {pr.user.login}</span>
                  <Show when={isMerged(pr)}><span class="text-purple-400">Merged</span></Show>
                  <Show when={!isMerged(pr) && pr.state === 'closed'}><span class="text-red-400">Closed</span></Show>
                </div>
              </div>
              <div class="text-xs text-gray-300 shrink-0">
                <Show when={(pr.additions ?? 0) > 0}>
                  <span class="text-green-400">+{pr.additions}</span>
                </Show>
                <Show when={(pr.deletions ?? 0) > 0}>
                  <span class="text-red-400 ml-1">-{pr.deletions}</span>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>

      <Show when={pulls() && pulls()!.length >= PAGE_SIZE}>
        <div class="flex justify-center gap-2 pt-1">
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={currentPage() <= 1}
            onClick={() => (state() === 'open' ? setOpenPage((p) => p - 1) : setClosedPage((p) => p - 1))}
          >
            {tt('pr.prevPage')}
          </button>
          <span class="px-2 py-1 text-xs text-gray-400">{ttf('pr.page', currentPage())}</span>
          <button
            class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
            disabled={pulls() && pulls()!.length < PAGE_SIZE}
            onClick={() => (state() === 'open' ? setOpenPage((p) => p + 1) : setClosedPage((p) => p + 1))}
          >
            {tt('pr.nextPage')}
          </button>
        </div>
      </Show>
    </>
  );

  return (
    <div class="space-y-2">
      <div class="flex gap-1 border-b border-white/10 pb-2">
        <button
          class={`px-3 py-1 text-xs rounded-lg transition-colors ${
            state() === 'open' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setState('open')}
          aria-pressed={state() === 'open'}
        >
          Open
        </button>
        <button
          class={`px-3 py-1 text-xs rounded-lg transition-colors ${
            state() === 'closed' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setState('closed')}
          aria-pressed={state() === 'closed'}
        >
          Closed
        </button>
        <div class="flex-1" />
        <button
          onClick={handleRefresh}
          class="px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
          title={tt('pr.refresh')}
          aria-label={tt('pr.refresh')}
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={props.onCreateNew}
          class="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          New PR
        </button>
      </div>

      <div class="animate-content-enter">
        {ListContent(currentPulls())}
      </div>
    </div>
  );
};

export default PlatformPRList;
