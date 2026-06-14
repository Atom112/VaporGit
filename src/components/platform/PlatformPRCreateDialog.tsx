import { Component, Show, createMemo, createResource, createSignal } from 'solid-js';
import { describeError } from '../../lib/gitErrorDesc';
import { getPlatformAdapter, PlatformKind } from '../../lib/platformAdapter';
import { commitStore } from '../../stores/commitStore';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import CustomSelect from '../ui/CustomSelect';

interface PlatformPRCreateDialogProps {
  kind: PlatformKind;
  owner: string;
  repo: string;
  defaultBase: string;
  onClose: () => void;
  onCreated: () => void;
}

const PlatformPRCreateDialog: Component<PlatformPRCreateDialogProps> = (props) => {
  const adapter = () => getPlatformAdapter(props.kind);
  const [title, setTitle] = createSignal('');
  const [body, setBody] = createSignal('');
  const [base, setBase] = createSignal(props.defaultBase);
  const [draft, setDraft] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [branches] = createResource(
    () => [props.kind, props.owner, props.repo] as const,
    ([, owner, repo]) => adapter().listBranches(owner, repo),
  );

  const headBranch = () => {
    const head = commitStore.branches.find((branch) => branch.isHead);
    return head?.name ?? '';
  };

  const headCommitContext = () => {
    const graph = commitStore.graphData;
    if (!graph) return null;
    const node = graph.nodes.find((item) => item.isHead);
    if (!node) return null;
    return { shortId: node.shortId, message: node.message };
  };

  const branchOptions = createMemo(() =>
    branches()
      ?.filter((branch) => branch.name !== headBranch())
      .map((branch) => ({ value: branch.name, label: branch.name })) ?? [],
  );

  const hasOnlyOneBranch = createMemo(
    () => !branches.loading && !branches.error && branches()?.length === 1,
  );

  const canSubmit = () =>
    title().trim().length > 0 &&
    headBranch().length > 0 &&
    base().length > 0 &&
    !hasOnlyOneBranch();

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    setError(null);
    try {
      const pr = await adapter().createPR(props.owner, props.repo, {
        title: title().trim(),
        head: headBranch(),
        base: base(),
        body: body().trim() || null,
        draft: draft() || null,
      });
      addToast(ttf('pr.created', pr.number), 'success');
      props.onCreated();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="w-110 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 class="text-sm font-bold">{tt('pr.createTitle')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={props.onClose}
          >
            {tt('common.close')}
          </button>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span class="font-mono bg-white/10 px-2 py-1 rounded">{headBranch() || tt('pr.noBranch')}</span>
            <span>&rarr;</span>
            <span class="font-mono bg-white/10 px-2 py-1 rounded">{base()}</span>
            <span class="text-white/70">({props.owner}/{props.repo})</span>
          </div>

          <Show when={headCommitContext()}>
            {(ctx) => (
              <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/5">
                <svg class="w-3.5 h-3.5 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="font-mono text-cyan-400 text-xs">{ctx().shortId}</span>
                <span class="text-xs text-white/60 truncate">{ctx().message}</span>
              </div>
            )}
          </Show>

          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">{tt('pr.baseBranch')}</label>
            <Show when={!branches.loading && !branches.error} fallback={
              <>
                <Show when={branches.loading}>
                  <div class="w-full p-2 rounded-lg bg-white/10 text-sm text-gray-400">{tt('pr.loadingBranches')}</div>
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
              <Show when={!hasOnlyOneBranch()} fallback={
                <div class="w-full p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
                  {tt('pr.onlyOneBranch')}
                </div>
              }>
                <CustomSelect
                  value={base()}
                  onChange={(value) => setBase(value)}
                  options={branchOptions()}
                />
              </Show>
            </Show>
          </div>

          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">{tt('pr.prTitle')}</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder={tt('pr.prTitlePlaceholder')}
              value={title()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
          </div>

          <div>
            <label class="block text-xs font-medium mb-1 opacity-70">{tt('pr.body')}</label>
            <textarea
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              rows={4}
              placeholder={tt('pr.bodyPlaceholder')}
              value={body()}
              onInput={(e) => setBody(e.currentTarget.value)}
            />
          </div>

          <label class="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={draft()}
              onChange={(e) => setDraft(e.currentTarget.checked)}
              class="rounded bg-white/10 border-white/20"
            />
            {tt('pr.draft')}
          </label>

          <Show when={error()}>
            <div class="p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
              {error()}
            </div>
          </Show>

          <button
            class="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-30 text-sm font-medium transition-colors"
            onClick={handleSubmit}
            disabled={submitting() || !canSubmit()}
          >
            {submitting() ? tt('pr.submitting') : tt('pr.submitBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlatformPRCreateDialog;
