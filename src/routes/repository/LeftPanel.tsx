import { For, Show } from 'solid-js';
import BranchList from '../../components/git/BranchList';
import CommitDetail from '../../components/git/CommitDetail';
import CommitGraph from '../../components/git/CommitGraph';
import DiffView from '../../components/git/DiffView';
import { commitStore } from '../../stores/commitStore';
import { diffStore } from '../../stores/diffStore';
import { tt, ttf } from '../../i18n';
import type { CommitDetail as CommitDetailType, CommitInfo } from '../../lib/types';
import type { RepositoryLeftMode, RepositoryLeftTab } from '../../stores/repositoryStore';

interface LeftPanelProps {
  repoPath: string | null;
  leftMode: RepositoryLeftMode;
  leftTab: RepositoryLeftTab;
  searchQuery: string;
  searchResults: CommitInfo[] | null;
  searchLoading: boolean;
  commitLoading: boolean;
  commitDetail: CommitDetailType | null;
  selectedCommit: CommitInfo | null;
  selectedCommitFile: string | null;
  onBack: () => void;
  onCloseRepository: () => void;
  onLeftTabChange: (tab: RepositoryLeftTab) => void;
  onSearch: (query: string) => void;
  onSelectCommit: (commit: CommitInfo) => void;
  onSelectGraphNode: (nodeId: string) => void;
  onGraphCheckout: (commitId: string) => void;
  onGraphCreateBranch: (commitId: string) => void;
  onGraphCherryPick: (commitId: string) => void;
  onCreatePullRequest: () => void;
  onGraphCheckoutBranch: (branchName: string) => void;
  onGraphDeleteBranch: (branchName: string) => void;
  onBranchesRefresh: () => Promise<void>;
  onSelectCommitFile: (filePath: string) => void;
  onNavigateCommit: (commitId: string) => void;
}

const BackIcon = () => (
  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const SearchIcon = () => (
  <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LeftPanel = (props: LeftPanelProps) => (
  <div class="flex-1 flex flex-col bg-white/5 overflow-hidden">
    <Show when={props.leftMode !== 'tree'}>
      <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
        <button
          class="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          onClick={props.onBack}
        >
          <BackIcon />
          {tt('repo.back')}
        </button>
        <Show when={props.leftMode === 'detail'}>
          <span class="text-xs opacity-40">{tt('repo.commitDetail')}</span>
        </Show>
      </div>
    </Show>

    <Show when={props.leftMode === 'tree'}>
      <div class="flex flex-col h-full overflow-hidden animate-tree-enter min-h-0">
        <div class="flex items-center border-b border-white/10 shrink-0">
          <button
            class="flex items-center gap-1 px-3 py-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors shrink-0"
            onClick={props.onCloseRepository}
          >
            <BackIcon />
            {tt('repo.back')}
          </button>
          <button
            class={`flex-1 py-2 text-xs font-medium transition-colors ${
              props.leftTab === 'graph'
                ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => props.onLeftTabChange('graph')}
          >
            {tt('repo.commitGraph')}
          </button>
          <button
            class={`flex-1 py-2 text-xs font-medium transition-colors ${
              props.leftTab === 'branches'
                ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => props.onLeftTabChange('branches')}
          >
            {tt('repo.branches')}
          </button>
        </div>

        <Show when={props.leftTab === 'graph'}>
          <div class="flex-1 min-h-0 animate-content-enter flex flex-col">
            <div class="shrink-0 px-3 py-2 border-b border-white/10">
              <div class="relative">
                <SearchIcon />
                <input
                  class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                  placeholder={tt('repo.searchCommitsPlaceholder')}
                  value={props.searchQuery}
                  onInput={(e) => props.onSearch(e.currentTarget.value)}
                />
                <Show when={props.searchLoading}>
                  <div class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-cyan-400/50 border-t-transparent rounded-full animate-spin" />
                </Show>
              </div>
            </div>
            <Show
              when={!props.searchResults}
              fallback={
                <div class="flex-1 flex flex-col min-h-0">
                  <div class="shrink-0 px-3 py-1.5 text-xs text-white/50">
                    {ttf('repo.searchResults', props.searchResults!.length)}
                  </div>
                  <div class="flex-1 overflow-y-auto">
                    <For each={props.searchResults}>
                      {(commit) => (
                        <div
                          class="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
                          onClick={() => props.onSelectCommit(commit)}
                        >
                          <span class="font-mono text-cyan-400/70 shrink-0">{commit.shortId}</span>
                          <span class="truncate flex-1">{commit.message}</span>
                          <span class="text-white/40 shrink-0 text-[10px]">{commit.author}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              }
            >
              <Show
                when={!commitStore.graphLoading}
                fallback={<div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('common.loading')}</div>}
              >
                <Show
                  when={commitStore.graphData && commitStore.graphData.nodes.length > 0}
                  fallback={<div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('repo.noCommits')}</div>}
                >
                  <div id="commit-graph-area" class="flex flex-col h-full">
                    <CommitGraph
                      graphData={commitStore.graphData!}
                      selectedNodeId={commitStore.selectedNode?.id}
                      onSelectNode={props.onSelectGraphNode}
                      repoPath={props.repoPath ?? undefined}
                      onCheckout={props.onGraphCheckout}
                      onCreateBranch={props.onGraphCreateBranch}
                      onCherryPick={props.onGraphCherryPick}
                      onCreatePullRequest={props.onCreatePullRequest}
                      onCheckoutBranch={props.onGraphCheckoutBranch}
                      onDeleteBranch={props.onGraphDeleteBranch}
                    />
                    <Show when={commitStore.graphData?.truncated}>
                      <div class="shrink-0 px-3 py-1.5 text-xs text-yellow-400/70 bg-yellow-400/5 border-t border-yellow-400/10 text-center">
                        {tt('repo.graphTruncated')}
                      </div>
                    </Show>
                  </div>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={props.leftTab === 'branches'}>
          <div class="flex-1 min-h-0 animate-content-enter">
            <Show
              when={!commitStore.branchesLoading}
              fallback={<div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('common.loading')}</div>}
            >
              <Show
                when={commitStore.branches.length > 0}
                fallback={<div class="flex-1 flex items-center justify-center text-sm opacity-40">{tt('repo.noBranches')}</div>}
              >
                <BranchList
                  branches={commitStore.branches}
                  repoPath={props.repoPath!}
                  onRefresh={props.onBranchesRefresh}
                />
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </Show>

    <Show when={props.leftMode === 'detail'}>
      <div class="flex-1 flex flex-col animate-content-enter">
        <Show
          when={!props.commitLoading}
          fallback={<div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">{tt('common.loading')}</div>}
        >
          <Show when={props.commitDetail && props.selectedCommit}>
            <CommitDetail
              detail={props.commitDetail!}
              selectedFile={props.selectedCommitFile}
              onSelectFile={props.onSelectCommitFile}
              onNavigateCommit={props.onNavigateCommit}
            />
          </Show>
        </Show>
      </div>
    </Show>

    <Show when={props.leftMode === 'diff'}>
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden animate-content-enter">
        <Show
          when={diffStore.diffResult || diffStore.diffLoading}
          fallback={<div class="flex-1 h-full flex items-center justify-center opacity-40 text-sm">{tt('repo.noDiff')}</div>}
        >
          <DiffView
            diffResult={diffStore.diffResult ?? undefined}
            loading={diffStore.diffLoading}
            filePath={diffStore.selectedFile ?? props.selectedCommit?.shortId ?? ''}
            commitId={props.selectedCommit?.id}
            repoPath={props.repoPath ?? undefined}
          />
        </Show>
      </div>
    </Show>
  </div>
);

export default LeftPanel;
