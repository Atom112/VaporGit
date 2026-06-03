import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { getBranchList, compareBranches } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { BranchInfo, BranchDiffSummary } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
}

const BranchCompareDialog: Component<Props> = (props) => {
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [baseBranch, setBaseBranch] = createSignal<string>('');
  const [targetBranch, setTargetBranch] = createSignal<string>('');
  const [loading, setLoading] = createSignal(false);
  const [branchesLoading, setBranchesLoading] = createSignal(false);
  const [result, setResult] = createSignal<BranchDiffSummary | null>(null);
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
        setBranches(list);
        const head = list.find((b) => b.isHead);
        if (head) {
          setBaseBranch(head.name);
        }
        if (list.length > 1) {
          const alt = list.find((b) => !b.isHead && !b.isRemote);
          if (alt) setTargetBranch(alt.name);
        }
      })
      .catch((e) => {
        addToast(`加载分支列表失败: ${describeError(e)}`, 'error');
      })
      .finally(() => setBranchesLoading(false));
  });

  const handleCompare = async () => {
    if (!baseBranch() || !targetBranch()) return;
    setLoading(true);
    setResult(null);
    try {
      const summary = await compareBranches(props.repoPath, baseBranch(), targetBranch());
      setResult(summary);
    } catch (e) {
      addToast(`分支对比失败: ${describeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-120 max-h-[85vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">{tt('repo.branchCompareTitle')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            {tt('common.close')}
          </button>
        </div>

        <div class="p-4 space-y-4 overflow-y-auto min-h-0">
          {/* Branch selectors */}
          <Show
            when={!branchesLoading()}
            fallback={<div class="text-xs opacity-40">{tt('common.loading')}</div>}
          >
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.branchCompareBase')}</label>
                <select
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  value={baseBranch()}
                  onChange={(e) => setBaseBranch(e.currentTarget.value)}
                >
                  <option value="" disabled class="bg-[#4a4a4e]">{tt('repo.branchCompareBase')}</option>
                  <For each={branches()}>
                    {(b) => (
                      <option value={b.name} class="bg-[#4a4a4e]">{b.name}{b.isRemote ? ' (remote)' : ''}</option>
                    )}
                  </For>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.branchCompareTarget')}</label>
                <select
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                  value={targetBranch()}
                  onChange={(e) => setTargetBranch(e.currentTarget.value)}
                >
                  <option value="" disabled class="bg-[#4a4a4e]">{tt('repo.branchCompareTarget')}</option>
                  <For each={branches()}>
                    {(b) => (
                      <option value={b.name} class="bg-[#4a4a4e]">{b.name}{b.isRemote ? ' (remote)' : ''}</option>
                    )}
                  </For>
                </select>
              </div>
            </div>

            <button
              class="w-full py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
              onClick={handleCompare}
              disabled={loading() || !baseBranch() || !targetBranch() || baseBranch() === targetBranch()}
            >
              {loading() ? tt('repo.branchCompareLoading') : tt('repo.compareBranches')}
            </button>
          </Show>

          {/* Results */}
          <Show when={result()}>
            {(r) => (
              <div class="space-y-3">
                {/* Ahead/Behind summary */}
                <div class="flex items-center justify-center gap-4 p-3 rounded-lg bg-white/5">
                  <div class="text-center">
                    <div class="text-lg font-bold text-green-400">{r().behind}</div>
                    <div class="text-xs text-white/50">{ttf('repo.branchCompareBehind', r().behind)}</div>
                  </div>
                  <svg class="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <div class="text-center">
                    <div class="text-lg font-bold text-cyan-400">{r().ahead}</div>
                    <div class="text-xs text-white/50">{ttf('repo.branchCompareAhead', r().ahead)}</div>
                  </div>
                </div>

                {/* File list */}
                <div class="text-xs text-white/50">{ttf('repo.branchCompareFiles', r().files.length)}</div>
                <div class="max-h-64 overflow-y-auto space-y-1">
                  <For each={r().files}>
                    {(f) => (
                      <div class="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/5 transition-colors">
                        <span class={`shrink-0 w-14 text-center font-medium ${
                          f.status === 'added' ? 'text-green-400' :
                          f.status === 'deleted' ? 'text-red-400' :
                          f.status === 'renamed' ? 'text-yellow-400' :
                          'text-cyan-300'
                        }`}>
                          {f.status === 'added' ? 'A' :
                           f.status === 'deleted' ? 'D' :
                           f.status === 'renamed' ? 'R' : 'M'}
                        </span>
                        <span class="truncate flex-1 font-mono">{f.filePath}</span>
                        <Show when={f.additions > 0}>
                          <span class="text-green-400 shrink-0">+{f.additions}</span>
                        </Show>
                        <Show when={f.deletions > 0}>
                          <span class="text-red-400 shrink-0">-{f.deletions}</span>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
};

export default BranchCompareDialog;
