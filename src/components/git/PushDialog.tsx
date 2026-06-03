import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { getBranchList, pushWithAutoCreate } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { settingsStore } from '../../stores/settingsStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { BranchInfo } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const PushDialog: Component<Props> = (props) => {
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [branchesLoading, setBranchesLoading] = createSignal(false);
  const [selectedBranch, setSelectedBranch] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<string | null>(null);

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  createEffect(() => {
    if (!props.repoPath) return;
    setBranchesLoading(true);
    getBranchList(props.repoPath)
      .then((list) => {
        const local = list.filter((b) => !b.isRemote);
        setBranches(local);
        const head = local.find((b) => b.isHead);
        if (head) {
          setSelectedBranch(head.name);
        }
      })
      .catch((e) => {
        addToast(`加载分支列表失败: ${describeError(e)}`, 'error');
      })
      .finally(() => setBranchesLoading(false));
  });

  const handlePush = async () => {
    if (!selectedBranch()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await pushWithAutoCreate(props.repoPath, settingsStore.defaultRemoteName, selectedBranch());
      if (res === 'auto_created_and_pushed') {
        addToast(tt('repo.pushAutoCreateSuccess'), 'success');
      } else {
        addToast(tt('repo.pushSuccess'), 'success');
      }
      props.onRefresh();
      handleClose();
    } catch (e) {
      const msg = ttf('repo.pushFailed', describeError(e));
      setResult(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-100 max-h-[85vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
        phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
      }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">{tt('repo.pushDialogTitle')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            {tt('common.close')}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
          {/* Remote name */}
          <div>
            <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.pushSelectRemote')}</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
              value={settingsStore.defaultRemoteName || 'origin'}
              disabled
            />
          </div>

          {/* Branch selector */}
          <div>
            <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.pushSelectBranch')}</label>
            <Show
              when={!branchesLoading()}
              fallback={<div class="text-xs opacity-40">{tt('common.loading')}</div>}
            >
              <select
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                value={selectedBranch()}
                onChange={(e) => setSelectedBranch(e.currentTarget.value)}
              >
                <For each={branches()}>
                  {(b) => (
                    <option value={b.name} class="bg-[#4a4a4e]">
                      {b.name}{b.isHead ? ` (${tt('repo.currentBranchLabel')})` : ''}
                    </option>
                  )}
                </For>
              </select>
            </Show>
          </div>

          {/* Result */}
          <Show when={result()}>
            <div class="p-3 rounded-lg text-sm bg-red-500/20 text-red-300">
              {result()}
            </div>
          </Show>

          {/* Actions */}
          <div class="flex gap-2 pt-2">
            <button
              class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
              onClick={handlePush}
              disabled={loading() || !selectedBranch()}
            >
              {loading() ? tt('repo.pushing') : tt('repo.pushConfirm')}
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

export default PushDialog;
