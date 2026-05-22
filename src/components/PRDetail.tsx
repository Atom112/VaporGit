import { Component, createSignal, createResource, Show, For } from 'solid-js';
import type { GitHubPullRequest, PullRequestFile } from '../lib/types';
import { githubGetPullFiles, githubListPullComments, githubMergePull } from '../lib/tauriCommands';
import { addToast } from '../stores/toastStore';
import DiffView from './DiffView';
import { parseGitHubPatch } from '../lib/diffParser';

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

  const pr = () => props.pr;

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
        addToast(`PR #${pr().number} 合并成功`, 'success');
      } else {
        addToast(`合并失败: ${result.message}`, 'error');
      }
    } catch (e) {
      addToast(`合并出错: ${e}`, 'error');
    } finally {
      setMerging(false);
      setShowMergeConfirm(false);
    }
  };

  const canMerge = pr().state === 'open' && !pr().draft && pr().mergeable !== false;

  return (
    <div class="h-full flex flex-col">
      {/* Header */}
      <div class="px-4 py-3 border-b border-white/10 shrink-0 space-y-2">
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            onClick={props.onBack}
          >
            &larr; 返回
          </button>
        </div>
        <h2 class="text-base font-bold text-white leading-snug">{pr().title}</h2>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class={pr().merged ? 'text-purple-400' : pr().state === 'open' ? 'text-green-400' : 'text-red-400'}>
            #{pr().number} {pr().merged ? 'Merged' : pr().state === 'open' ? 'Open' : 'Closed'}
          </span>
          <span>{pr().user.login} 创建于 {new Date(pr().createdAt).toLocaleDateString()}</span>
          <Show when={pr().mergedAt}>
            <span>合并于 {new Date(pr().mergedAt!).toLocaleDateString()}</span>
          </Show>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-gray-500">{pr().base.label}</span>
          <span class="text-gray-600">&larr;</span>
          <span class="text-gray-500">{pr().head.label}</span>
        </div>

        {/* Merge button area */}
        <Show when={canMerge}>
          <Show when={!showMergeConfirm()} fallback={
            <div class="flex items-center gap-2 p-2 rounded-lg bg-white/5">
              <select
                class="px-2 py-1 text-xs rounded bg-white/10 text-white border border-white/10 focus:outline-none"
                value={mergeMethod()}
                onChange={(e) => setMergeMethod(e.currentTarget.value as any)}
              >
                <option value="merge">Merge commit</option>
                <option value="squash">Squash</option>
                <option value="rebase">Rebase</option>
              </select>
              <button
                class="px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-30 transition-colors"
                onClick={handleMerge}
                disabled={merging()}
              >
                {merging() ? '合并中...' : '确认合并'}
              </button>
              <button
                class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={() => setShowMergeConfirm(false)}
              >
                取消
              </button>
            </div>
          }>
            <button
              class="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
              onClick={() => setShowMergeConfirm(true)}
            >
              Merge PR
            </button>
          </Show>
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
                <div class="p-4 text-xs text-gray-500">加载中...</div>
              </Show>
              <Show when={files.error}>
                <div class="p-3 text-xs text-red-400">加载失败</div>
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
                  选择一个文件查看 Diff
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
              <div class="text-xs text-gray-500">加载评论中...</div>
            </Show>
            <Show when={comments.error}>
              <div class="text-xs text-red-400">加载评论失败</div>
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
          {file()?.status === 'removed' ? '文件已删除，无差异内容' : '无法加载差异内容'}
        </div>
      }>
        <DiffView diffResult={diffResult()} loading={false} filePath={props.filename} />
      </Show>
    </div>
  );
};

export default PRDetail;
