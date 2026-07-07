import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { mergeBranch, getBranchList } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { BranchInfo } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const MergeDialog: Component<Props> = (props) => {
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = createSignal<string>('');
  const [strategy, setStrategy] = createSignal<'merge_commit' | 'fast_forward' | 'squash'>('merge_commit');
  const [loading, setLoading] = createSignal(false);
  const [branchesLoading, setBranchesLoading] = createSignal(false);
  const [currentBranch, setCurrentBranch] = createSignal('');
  const [result, setResult] = createSignal<string | null>(null);
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  createEffect(() => {
    if (!props.repoPath) return;
    setBranchesLoading(true);
    getBranchList(props.repoPath)
      .then((list) => {
        // Store current branch and filter it out from the selector
        const current = list.find((b) => b.isHead);
        if (current) setCurrentBranch(current.name);
        setBranches(list.filter((b) => !b.isHead));
      })
      .catch((e) => {
        addToast(`加载分支列表失败: ${describeError(e)}`, 'error');
      })
      .finally(() => setBranchesLoading(false));
  });

  const handleMerge = async () => {
    if (!selectedBranch()) return;
    setLoading(true);
    setResult(null);
    try {
      const msg = await mergeBranch(props.repoPath, selectedBranch(), strategy());
      setResult(msg);
      addToast(tt('repo.mergeSuccess'), 'success');
      props.onRefresh();
    } catch (e) {
      addToast(ttf('repo.mergeFailed', describeError(e)), 'error');
      setResult(`错误: ${describeError(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-96 max-h-[80vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">{tt('repo.merge')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            {tt('common.close')}
          </button>
        </div>

        <div class="p-4 space-y-4">
          {/* Current branch info */}
          <Show when={currentBranch()}>
            <div class="text-xs opacity-60">
              {tt('repo.branches')}: <span class="font-mono text-cyan-300">{currentBranch()}</span>
            </div>
          </Show>

          {/* Branch selector */}
          <div>
            <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.mergeSelectBranch')}</label>
            <Show
              when={!branchesLoading()}
              fallback={<div class="text-xs opacity-40">{tt('common.loading')}</div>}
            >
              <Show
                when={branches().length > 0}
                fallback={<div class="text-xs opacity-40">{tt('repo.noBranches')}</div>}
              >
                <select
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  value={selectedBranch()}
                  onChange={(e) => setSelectedBranch(e.currentTarget.value)}
                >
                  <option value="" disabled class="bg-[#4a4a4e]">{tt('repo.mergeSelectBranch')}</option>
                  <For each={branches()}>
                    {(branch) => (
                      <option value={branch.name} class="bg-[#4a4a4e]">{branch.name}</option>
                    )}
                  </For>
                </select>
              </Show>
            </Show>
          </div>

          {/* Strategy selector */}
          <div>
            <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.mergeStrategy')}</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm cursor-pointer hover:text-white/80 transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  class="accent-cyan-400"
                  checked={strategy() === 'merge_commit'}
                  onChange={() => setStrategy('merge_commit')}
                />
                <span>{tt('repo.mergeStrategyMergeCommit')}</span>
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer hover:text-white/80 transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  class="accent-cyan-400"
                  checked={strategy() === 'fast_forward'}
                  onChange={() => setStrategy('fast_forward')}
                />
                <span>{tt('repo.mergeStrategyFastForward')}</span>
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer hover:text-white/80 transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  class="accent-cyan-400"
                  checked={strategy() === 'squash'}
                  onChange={() => setStrategy('squash')}
                />
                <span>{tt('repo.mergeStrategySquash')}</span>
              </label>
            </div>
          </div>

          {/* Result message */}
          <Show when={result()}>
            <div class={`p-3 rounded-lg text-sm ${
              result()?.startsWith('错误') || result()?.includes('冲突')
                ? 'bg-red-500/20 text-red-300'
                : 'bg-green-500/20 text-green-300'
            }`}>
              {result()}
            </div>
          </Show>

          {/* Actions */}
          <div class="flex gap-2 pt-2">
            <button
              class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
              onClick={handleMerge}
              disabled={loading() || !selectedBranch()}
            >
              {loading() ? tt('repo.merging') : tt('repo.merge')}
            </button>
            <button
              class="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
              onClick={handleClose}
            >
              {tt('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeDialog;
