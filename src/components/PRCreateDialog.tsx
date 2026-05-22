import { Component, createSignal, createResource, createMemo, Show } from 'solid-js';
import { githubCreatePull, githubListBranches } from '../lib/tauriCommands';
import CustomSelect from './CustomSelect';
import { addToast } from '../stores/toastStore';
import { commitStore } from '../stores/commitStore';

interface Props {
  owner: string;
  repo: string;
  defaultBase: string;
  onClose: () => void;
  onCreated: () => void;
}

const PRCreateDialog: Component<Props> = (props) => {
  const [title, setTitle] = createSignal('');
  const [body, setBody] = createSignal('');
  const [base, setBase] = createSignal(props.defaultBase);
  const [draft, setDraft] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch branches on mount
  const [branches] = createResource(
    () => [props.owner, props.repo] as const,
    ([owner, repo]) => githubListBranches(owner, repo)
  );

  // Get current branch as head
  const headBranch = () => {
    const branches = commitStore.branches;
    const head = branches.find((b) => b.isHead);
    return head?.name ?? '';
  };

  // Get HEAD commit context for display
  const headCommitContext = () => {
    const graph = commitStore.graphData;
    if (!graph) return null;
    const node = graph.nodes.find((n) => n.isHead);
    if (!node) return null;
    return { shortId: node.shortId, message: node.message };
  };

  const canSubmit = () => title().trim().length > 0 && headBranch().length > 0 && base().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    setError(null);
    try {
      const pr = await githubCreatePull(props.owner, props.repo, {
        title: title().trim(),
        head: headBranch(),
        base: base(),
        body: body().trim() || null,
        draft: draft() || null,
      });
      addToast(`PR #${pr.number} 创建成功`, 'success');
      props.onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const branchOptions = createMemo(() =>
    branches()
      ?.filter((b) => b.name !== headBranch())
      .map((b) => ({ value: b.name, label: b.name })) ?? []
  );

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="w-110 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 class="text-sm font-bold">创建 Pull Request</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>
        <div class="p-4 space-y-3">
          {/* Branch info */}
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span class="font-mono bg-white/10 px-2 py-1 rounded">{headBranch() || '(no branch)'}</span>
            <span>&rarr;</span>
            <span class="font-mono bg-white/10 px-2 py-1 rounded">{base()}</span>
            <span class="text-white/70">({props.owner}/{props.repo})</span>
          </div>

          {/* Commit context */}
          <Show when={headCommitContext()}>
            {(ctx) => (
              <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <svg class="w-3.5 h-3.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="font-mono text-cyan-400 text-xs">{ctx().shortId}</span>
                <span class="text-xs text-white/60 truncate">{ctx().message}</span>
              </div>
            )}
          </Show>

          {/* Base branch — dropdown from repo */}
          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">目标分支 (base)</label>
            <Show when={!branches.loading && !branches.error} fallback={
              <>
                <Show when={branches.loading}>
                  <div class="w-full p-2 rounded-lg bg-white/10 text-sm text-gray-400">加载分支列表...</div>
                </Show>
                <Show when={branches.error}>
                  <input
                    class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                    value={base()}
                    onInput={(e) => setBase(e.currentTarget.value)}
                  />
                </Show>
              </>
            }>
              <CustomSelect
                value={base()}
                onChange={(v) => setBase(v)}
                options={branchOptions()}
              />
            </Show>
          </div>

          {/* Title */}
          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">标题</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder="PR 标题"
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </div>

          {/* Body */}
          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">描述（可选）</label>
            <textarea
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              rows={4}
              placeholder="描述此 PR 的变更内容..."
              value={body()}
              onInput={(e) => setBody(e.currentTarget.value)}
            />
          </div>

          {/* Draft checkbox */}
          <label class="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={draft()}
              onChange={(e) => setDraft(e.currentTarget.checked)}
              class="rounded bg-white/10 border-white/20"
            />
            标记为 Draft（草稿）
          </label>

          {/* Error */}
          <Show when={error()}>
            <div class="p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
              {error()}
            </div>
          </Show>

          {/* Submit */}
          <button
            class="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-30 text-sm font-medium transition-colors"
            onClick={handleSubmit}
            disabled={submitting() || !canSubmit()}
          >
            {submitting() ? '创建中...' : `创建 Pull Request`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PRCreateDialog;
