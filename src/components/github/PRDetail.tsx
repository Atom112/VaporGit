import { Component, createSignal, createResource, Show, For } from 'solid-js';
import type { GitHubPullRequest, PullRequestFile } from '../../lib/types';
import { githubGetPullFiles, githubListPullComments, githubGetPull, githubMergePull } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import DiffView from '../git/DiffView';
import { parseGitHubPatch } from '../../lib/diffParser';
import CustomSelect from '../ui/CustomSelect';

interface Props {
  owner: string;
  repo: string;
  pr: GitHubPullRequest;
  onBack: () => void;
}

const PRDetail: Component<Props> = (props) => {
  const [tab, setTab] = createSignal<'conversation' | 'files'>('files');
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [mergeMethod, setMergeMethod] = createSignal<'merge' | 'squash' | 'rebase'>('merge');
  const [merging, setMerging] = createSignal(false);
  const [showMergeConfirm, setShowMergeConfirm] = createSignal(false);
  const [mergeConflict, setMergeConflict] = createSignal<'loading' | 'conflict' | 'ok' | null>(null);

  const pr = () => props.pr;
  const isMerged = () => pr().mergedAt !== null;

  // Options for CustomSelect
  const mergeMethodOptions = () => [
    { value: 'merge', label: tt('Merge') },
    { value: 'squash', label: tt('Squash') },
    { value: 'rebase', label: tt('Rebase') },
  ];

  // Check mergeability on show — fetch fresh PR data from GitHub
  const checkMergeConflict = async () => {
    setMergeConflict('loading');
    try {
      const freshPr = await githubGetPull(props.owner, props.repo, pr().number);
      const m = freshPr.mergeable;
      if (m === false) {
        setMergeConflict('conflict');
      } else if (m === null) {
        // Still computing — show loading, user can try again later
        setMergeConflict('loading');
      } else {
        setMergeConflict('ok');
      }
    } catch {
      // If request fails, allow merge attempt (GitHub will validate)
      setMergeConflict('ok');
    }
  };

  // Fetch PR files
  const [files] = createResource(
    () => pr().number,
    async (num) => {
      return githubGetPullFiles(props.owner, props.repo, num);
    }
  );

  // Fetch PR comments
  const [comments] = createResource(
    () => pr().number,
    async (num) => {
      return githubListPullComments(props.owner, props.repo, num);
    }
  );

  const handleMerge = async () => {
    setMerging(true);
    try {
      const result = await githubMergePull(props.owner, props.repo, pr().number, {
        mergeMethod: mergeMethod(),
      });
      if (result.merged) {
        addToast(`PR #${pr().number} ${tt('common.success')}`, 'success');
        props.onBack();
      } else {
        addToast(`${tt('common.error')}: ${result.message}`, 'error');
      }
    } catch (e) {
      addToast(`${tt('common.error')}: ${describeError(e)}`, 'error');
    } finally {
      setMerging(false);
      setShowMergeConfirm(false);
    }
  };

  const canMerge = pr().state === 'open' && !pr().draft;

  return (
    <div class="h-full flex flex-col">
      {/* Header */}
      <div class="px-4 py-3 border-b border-white/10 shrink-0 space-y-2">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={props.onBack}
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {tt('pr.back')}
          </button>
        </div>
        <h2 class="text-base font-bold text-white leading-snug">{pr().title}</h2>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class={isMerged() ? 'text-purple-400' : pr().state === 'open' ? 'text-green-400' : 'text-red-400'}>
            #{pr().number} {isMerged() ? 'Merged' : pr().state === 'open' ? 'Open' : 'Closed'}
          </span>
          <span>{ttf('pr.createdBy', pr().user.login, new Date(pr().createdAt).toLocaleDateString())}</span>
          <Show when={pr().mergedAt}>
            <span>{ttf('pr.mergedOn', new Date(pr().mergedAt!).toLocaleDateString())}</span>
          </Show>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">{pr().base.label}</span>
          <svg class="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">{pr().head.label}</span>
        </div>

        {/* Merge button area */}
        <Show when={canMerge && mergeConflict() !== 'loading'}>
          <Show when={!showMergeConfirm()} fallback={
            <div class="space-y-2">
              <Show when={mergeConflict() === 'conflict'}>
                <div class="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {tt('pr.mergeConflict')}
                </div>
              </Show>
              <div class="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                <CustomSelect
                  value={mergeMethod()}
                  onChange={(v) => setMergeMethod(v as any)}
                  options={mergeMethodOptions()}
                  class="w-40"
                />
                <button
                  class="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  onClick={handleMerge}
                  disabled={merging() || mergeConflict() === 'conflict'}
                >
                  {merging() ? tt('pr.merging') : tt('pr.mergeConfirm')}
                </button>
                <button
                  class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => setShowMergeConfirm(false)}
                >
                  {tt('pr.cancel')}
                </button>
              </div>
            </div>
          }>
            <button
              class="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
              onClick={() => { checkMergeConflict(); setShowMergeConfirm(true); }}
            >
              Merge PR
            </button>
          </Show>
        </Show>

        {/* mergeable: null — GitHub hasn't computed yet */}
        <Show when={canMerge && mergeConflict() === 'loading'}>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            {tt('pr.checkingMerge')}
          </div>
        </Show>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-white/10 shrink-0">
        <button
          class={`px-4 py-2 text-xs transition-colors ${
            tab() === 'files' ? 'text-cyan-400 border-b-2 border-b-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setTab('files')}
        >
          Files Changed
          <Show when={files()}> ({files()!.length})</Show>
        </button>
        <button
          class={`px-4 py-2 text-xs transition-colors ${
            tab() === 'conversation' ? 'text-cyan-400 border-b-2 border-b-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => setTab('conversation')}
        >
          Comments
          <Show when={comments()}> ({comments()!.length})</Show>
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        {/* Files tab */}
        <Show when={tab() === 'files'}>
          <div class="flex h-full">
            {/* File list sidebar */}
            <div class="w-56 shrink-0 border-r border-white/10 overflow-auto">
              <Show when={files.loading}>
                <div class="p-4 text-xs text-gray-500">{tt('pr.loadingFiles')}</div>
              </Show>
              <Show when={files.error}>
                <div class="p-3 text-xs text-red-400">{tt('pr.loadFailed')}</div>
              </Show>
              <For each={files()}>
                {(f) => (
                  <div
                    class={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                      selectedFile() === f.filename
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                    onClick={() => setSelectedFile(f.filename)}
                  >
                    <span class="truncate flex-1 mr-2">{f.filename}</span>
                    <div class="flex gap-1 shrink-0">
                      <Show when={f.additions > 0}>
                        <span class="text-green-400">+{f.additions}</span>
                      </Show>
                      <Show when={f.deletions > 0}>
                        <span class="text-red-400">-{f.deletions}</span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Diff view */}
            <div class="flex-1 overflow-auto">
              <Show when={!selectedFile()}>
                <div class="flex items-center justify-center h-full text-xs text-gray-500">
                  {tt('pr.selectFile')}
                </div>
              </Show>
              <Show when={selectedFile()}>
                <FileDiffView
                  owner={props.owner}
                  repo={props.repo}
                  number={pr().number}
                  filename={selectedFile()!}
                  files={files() ?? []}
                />
              </Show>
            </div>
          </div>
        </Show>

        {/* Comments tab */}
        <Show when={tab() === 'conversation'}>
          <div class="p-4 space-y-3">
            {/* PR body */}
            <Show when={pr().body}>
              <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                <p class="text-xs text-gray-300 whitespace-pre-wrap">{pr().body}</p>
              </div>
            </Show>

            <Show when={comments.loading}>
              <div class="text-xs text-gray-500">{tt('pr.loadingComments')}</div>
            </Show>
            <Show when={comments.error}>
              <div class="text-xs text-red-400">{tt('pr.loadCommentsFailed')}</div>
            </Show>

            <For each={comments()}>
              {(comment) => (
                <div class="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div class="flex items-center gap-2 mb-1.5">
                    <img
                      src={comment.user.avatarUrl}
                      alt=""
                      class="w-5 h-5 rounded-full"
                    />
                    <span class="text-xs font-medium text-white">{comment.user.login}</span>
                    <span class="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    <Show when={comment.path}>
                      <span class="text-xs text-cyan-400 ml-auto truncate">{comment.path}:{comment.position}</span>
                    </Show>
                  </div>
                  <p class="text-xs text-gray-300 whitespace-pre-wrap">{comment.body}</p>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};

/** Sub-component to show a single file's diff from the PR */
const FileDiffView: Component<{
  owner: string;
  repo: string;
  number: number;
  filename: string;
  files: PullRequestFile[];
}> = (props) => {
  const file = () => props.files.find((f) => f.filename === props.filename);

  // Try to use the patch from the files list first
  const diffResult = () => {
    const f = file();
    if (!f?.patch) return undefined;
    return parseGitHubPatch(f.filename, f.patch);
  };

  return (
    <div class="p-2">
      <Show when={diffResult()} fallback={
        <div class="text-xs text-gray-500 text-center py-8">
          {file()?.status === 'removed' ? tt('pr.fileRemoved') : tt('pr.noDiff')}
        </div>
      }>
        <DiffView diffResult={diffResult()} loading={false} filePath={props.filename} />
      </Show>
    </div>
  );
};

export default PRDetail;
