import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { giteeListPulls } from '../../lib/tauriCommands';
import { tt, ttf } from '../../i18n';
import type { GiteePullRequest } from '../../lib/types';

interface Props {
  owner: string;
  repo: string;
  onSelect: (pr: GiteePullRequest) => void;
  onCreateNew: () => void;
}

const PR_LIST_TIMEOUT = 20000;

async function fetchPulls(owner: string, repo: string, state: string, page: number): Promise<GiteePullRequest[]> {
  const result = await Promise.race([
    giteeListPulls(owner, repo, state, page, 30),
    new Promise<GiteePullRequest[]>((_, reject) =>
      setTimeout(() => reject(new Error(tt('pr.fetchTimeout'))), PR_LIST_TIMEOUT)
    ),
  ]);
  return result;
}

const GiteePRList: Component<Props> = (props) => {
  const [state, setState] = createSignal<'open' | 'closed'>('open');
  const [openPage, setOpenPage] = createSignal(1);
  const [closedPage, setClosedPage] = createSignal(1);

  const [openPulls, { refetch: refetchOpen }] = createResource(
    () => openPage(),
    (page) => fetchPulls(props.owner, props.repo, 'open', page)
  );

  const [closedPulls, { refetch: refetchClosed }] = createResource(
    () => closedPage(),
    (page) => fetchPulls(props.owner, props.repo, 'closed', page)
  );

  const currentPage = () => (state() === 'open' ? openPage() : closedPage());

  const handleRefresh = () => {
    refetchOpen();
    refetchClosed();
  };

  const isMerged = (pr: GiteePullRequest) => pr.mergedAt !== null;

  const stateColor = (pr: GiteePullRequest) => {
    if (isMerged(pr)) return 'text-purple-400';
    if (pr.state === 'closed') return 'text-red-400';
    return 'text-green-400';
  };

  const stateIcon = (pr: GiteePullRequest) => {
    if (isMerged(pr)) {
      return (
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 1024 1024" fill="currentColor">
          <path d="M303.146667 375.04A128.042667 128.042667 0 0 0 426.666667 469.333333h170.666666a213.418667 213.418667 0 0 1 210.218667 176.896A128.042667 128.042667 0 0 1 768 896a128 128 0 0 1-47.146667-247.04A128.042667 128.042667 0 0 0 597.333333 554.666667h-170.666666a212.394667 212.394667 0 0 1-128-42.666667v135.253333a128.042667 128.042667 0 1 1-85.333334 0V376.746667a128.042667 128.042667 0 1 1 89.813334-1.706667zM256 298.666667a42.666667 42.666667 0 1 0 0-85.333334 42.666667 42.666667 0 0 0 0 85.333334z m0 512a42.666667 42.666667 0 1 0 0-85.333334 42.666667 42.666667 0 0 0 0 85.333334z m512 0a42.666667 42.666667 0 1 0 0-85.333334 42.666667 42.666667 0 0 0 0 85.333334z" />
        </svg>
      );
    }
    if (pr.state === 'closed') {
      return (
        <svg class="w-4 h-4 shrink-0" viewBox="0 0 1024 1024" fill="currentColor">
          <path d="M367.397 296.72c17.002-23.378 25.504-51.007 25.504-82.887 0-19.128-3.719-38.255-11.158-57.383s-18.065-35.599-31.879-49.413-30.285-24.441-49.413-31.879C281.322 67.719 262.195 64 243.067 64c-31.879 0-60.04 8.501-84.481 25.504s-42.506 39.318-54.195 66.947-14.877 56.32-9.564 86.075 18.596 55.258 39.849 76.511 46.757 35.067 76.511 41.443v302.855c-29.754 6.376-55.258 20.19-76.511 41.443s-34.536 46.757-39.849 76.511c-5.313 29.754-2.125 58.446 9.564 86.074s29.754 49.944 54.195 66.947c24.441 17.002 52.601 25.504 84.481 25.504 19.128 0 38.255-3.719 57.383-11.158s35.599-18.596 49.413-33.473c13.814-14.877 24.441-31.348 31.879-49.413 7.439-18.065 11.158-37.724 11.158-58.977 0-29.754-8.501-57.383-25.504-82.887-17.002-25.504-39.318-43.569-66.947-54.195-8.501-4.251-17.002-7.439-25.504-9.564V360.479l25.504-6.376c27.63-12.752 49.945-31.879 66.948-57.383z m-44.631 471.816c8.501 14.877 12.22 30.285 11.158 46.225-1.063 15.94-6.376 31.348-15.94 46.225s-22.847 25.504-39.849 31.879c-17.002 6.376-34.005 7.97-51.007 4.782-17.002-3.188-32.411-11.158-46.225-23.91s-22.316-28.16-25.504-46.225c-3.188-18.065-1.063-35.067 6.376-51.007 7.439-15.94 18.596-29.223 33.473-39.849s30.817-15.94 47.819-15.94c17.002 0 32.411 4.251 46.225 12.752 13.815 8.502 24.972 20.191 33.474 35.068z m-127.518-481.38c-14.877-10.626-26.035-24.441-33.473-41.443s-9.564-34.005-6.376-51.007 11.158-31.879 23.91-44.631c12.752-12.752 28.16-21.253 46.225-25.504 18.065-4.251 35.599-2.657 52.601 4.782s30.285 18.065 39.849 31.879c9.564 13.814 14.877 29.223 15.94 46.225s-2.657 32.942-11.158 47.819c-8.501 14.877-19.659 26.566-33.473 35.067s-29.223 12.752-46.225 12.752c-17.003 0.001-32.943-5.312-47.82-15.939z m615.273 162.585h-57.383v213.592c-21.253 4.251-39.318 11.689-54.195 22.316-25.504 17.002-44.1 39.318-55.789 66.947s-14.346 56.32-7.97 86.075c6.376 29.754 20.19 55.258 41.443 76.511s46.757 35.067 76.511 41.443c29.754 6.376 58.446 3.719 86.075-7.97 27.629-11.689 49.944-30.285 66.947-55.789 17.002-25.504 25.504-53.132 25.504-82.887 0-40.381-14.877-75.448-44.631-105.202-21.253-21.253-46.757-35.067-76.511-41.443V449.741z m35.068 423.997c-14.877 14.877-32.942 23.378-54.195 25.504-21.253 2.125-40.381-2.657-57.383-14.346-17.002-11.689-28.691-25.504-35.067-41.443-6.376-15.94-7.97-32.942-4.782-51.007 3.188-18.065 11.158-33.473 23.91-46.225 12.752-12.752 28.16-20.722 46.225-23.91 18.065-3.188 35.599-1.594 52.601 4.782 17.002 6.376 30.817 18.065 41.443 35.067s14.877 36.13 12.752 57.383c-2.126 21.253-10.627 39.318-25.504 54.195zM631.996 105.443L673.44 64l98.826 98.826L874.28 64l41.443 41.443-98.826 102.014 98.826 98.826-41.443 44.631-102.014-102.013-98.826 102.014-41.443-44.631 98.826-98.826-98.827-102.015z" />
        </svg>
      );
    }
    return (
      <svg class="w-4 h-4 shrink-0" viewBox="0 0 1024 1024" fill="currentColor">
        <path d="M128 789.333333C128 871.68 194.986667 938.666667 277.333333 938.666667s149.333333-66.986667 149.333334-149.333334c0-67.413333-45.226667-123.861333-106.666667-142.378666V377.045333C381.44 358.528 426.666667 302.08 426.666667 234.666667 426.666667 152.32 359.68 85.333333 277.333333 85.333333S128 152.32 128 234.666667c0 67.413333 45.226667 123.861333 106.666667 142.378666v269.909334C173.226667 665.472 128 721.92 128 789.333333z m213.333333 0c0 35.285333-28.714667 64-64 64S213.333333 824.618667 213.333333 789.333333 242.048 725.333333 277.333333 725.333333s64 28.714667 64 64z m-128-554.666666C213.333333 199.381333 242.048 170.666667 277.333333 170.666667S341.333333 199.381333 341.333333 234.666667 312.618667 298.666667 277.333333 298.666667 213.333333 269.952 213.333333 234.666667z m682.666667 554.666666c0-67.413333-45.226667-123.861333-106.666667-142.378666V341.333333c0-64.384-40.917333-157.141333-149.333333-168.405333V85.333333l-170.666667 128 170.666667 128V258.346667c57.514667 11.008 63.701333 65.237333 64 82.986666v305.621334c-61.44 18.517333-106.666667 74.965333-106.666667 142.378666 0 82.346667 66.986667 149.333333 149.333334 149.333334s149.333333-66.986667 149.333333-149.333334zM746.666667 853.333333c-35.285333 0-64-28.714667-64-64s28.714667-64 64-64 64 28.714667 64 64-28.714667 64-64 64z" />
      </svg>
    );
  };

  const ListContent = (pulls: typeof openPulls) => (
    <>
      <Show when={pulls.loading}>
        <div class="flex items-center justify-center py-8">
          <div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">{tt('pr.loading')}</span>
        </div>
      </Show>

      <Show when={pulls.error}>
        <div class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
          {tt('pr.loadFailed')}: {String(pulls.error)}
        </div>
      </Show>

      <Show when={!pulls.loading && !pulls.error && pulls()?.length === 0}>
        <div class="text-center py-8 text-sm text-gray-500">{tt('pr.empty')}</div>
      </Show>

      <div class="space-y-1">
        <For each={pulls()}>
          {(pr) => (
            <div
              class="flex items-start gap-2 p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/6 cursor-pointer transition-colors"
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
                <div class="flex items-center gap-2 text-xs text-gray-300 mt-0.5">
                  <span>#{pr.number}</span>
                  <span>by {pr.user.login}</span>
                  <Show when={isMerged(pr)}><span class="text-purple-400">Merged</span></Show>
                  <Show when={!isMerged(pr) && pr.state === 'closed'}><span class="text-red-400">Closed</span></Show>
                </div>
              </div>
              <div class="text-xs text-gray-300 shrink-0">
                {(pr.additions ?? 0) > 0 && <span class="text-green-400">+{pr.additions}</span>}
                {(pr.deletions ?? 0) > 0 && <span class="text-red-400 ml-1">-{pr.deletions}</span>}
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={pulls() && pulls()!.length >= 30}>
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
            disabled={pulls() && pulls()!.length < 30}
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
        >
          Open
        </button>
        <button
          class={`px-3 py-1 text-xs rounded-lg transition-colors ${
            state() === 'closed' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setState('closed')}
        >
          Closed
        </button>
        <div class="flex-1" />
        <button
          onClick={handleRefresh}
          class="px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
          title={tt('pr.refresh')}
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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

      <Show when={state() === 'open'} fallback={
        <div class="animate-content-enter">
          {ListContent(closedPulls)}
        </div>
      }>
        <div class="animate-content-enter">
          {ListContent(openPulls)}
        </div>
      </Show>
    </div>
  );
};

export default GiteePRList;
