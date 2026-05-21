import { Component, For, Show, createSignal } from 'solid-js';
import { checkoutBranch, createBranch, deleteBranch } from '../lib/tauriCommands';
import { addToast } from '../stores/toastStore';
import type { BranchInfo } from '../lib/types';

interface BranchListProps {
  branches: BranchInfo[];
  repoPath: string;
  onRefresh: () => Promise<void> | void;
}

const BranchList: Component<BranchListProps> = (props) => {
  const [newName, setNewName] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [confirmDelete, setConfirmDelete] = createSignal<string | null>(null);
  const [checkoutBranchName, setCheckoutBranchName] = createSignal<string | null>(null);

  const localBranches = () => props.branches.filter((b) => !b.isRemote);
  const remoteBranches = () => props.branches.filter((b) => b.isRemote);
  const currentBranch = () => localBranches().find((b) => b.isHead);

  const handleCheckout = async (name: string) => {
    if (name === currentBranch()?.name) return;
    setCheckoutBranchName(name);
    setError(null);
    try {
      await checkoutBranch(props.repoPath, name);
      addToast(`已切换到分支 ${name}`, 'success');
      await props.onRefresh();
    } catch (e) {
      addToast(`切换分支失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setCheckoutBranchName(null);
    }
  };

  const handleCreate = async () => {
    const name = newName().trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await createBranch(props.repoPath, name);
      addToast(`分支 ${name} 创建成功`, 'success');
      setNewName('');
      props.onRefresh();
    } catch (e) {
      addToast(`创建分支失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    setError(null);
    try {
      await deleteBranch(props.repoPath, name);
      addToast(`分支 ${name} 已删除`, 'success');
      setConfirmDelete(null);
      props.onRefresh();
    } catch (e) {
      addToast(`删除分支失败: ${e}`, 'error');
      setError(String(e));
    }
  };

  return (
    <div class="flex flex-col h-full relative">
      {/* Create branch */}
      <div class="p-3 border-b border-white/10 shrink-0">
        <div class="flex gap-2">
          <input
            class="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
            placeholder="新分支名称..."
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            class="px-3 py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-xs font-medium transition-colors"
            disabled={!newName().trim() || creating()}
            onClick={handleCreate}
          >
            创建
          </button>
        </div>
      </div>

      {/* Branch list */}
      <div class="flex-1 overflow-auto divide-y divide-white/5">
        <Show when={localBranches().length > 0 || remoteBranches().length > 0} fallback={
          <div class="flex items-center justify-center h-full text-sm opacity-40">无分支</div>
        }>
          <div class="px-3 py-2 text-[10px] font-semibold opacity-40 uppercase tracking-wider">本地分支</div>
          <For each={localBranches()}>
            {(branch) => {
              const isCurrent = branch.isHead;
              return (
                <div
                  class={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                  }`}
                  onClick={() => handleCheckout(branch.name)}
                >
                  <svg class="w-3 h-3 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span class={`truncate flex-1 ${isCurrent ? 'font-semibold text-white' : 'opacity-80'}`}>
                    {branch.name}
                  </span>
                  <Show when={branch.ahead > 0 || branch.behind > 0}>
                    <div class="flex items-center gap-1 text-[10px] shrink-0">
                      <Show when={branch.ahead > 0}>
                        <span class="text-green-400">+{branch.ahead}</span>
                      </Show>
                      <Show when={branch.behind > 0}>
                        <span class="text-red-400">-{branch.behind}</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={!isCurrent && !confirmDelete()}>
                    <button
                      class="text-xs opacity-30 hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(branch.name); }}
                      title="删除分支"
                    >
                      ✕
                    </button>
                  </Show>
                  <Show when={confirmDelete() === branch.name}>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        class="text-xs text-red-400 hover:text-red-300"
                        onClick={(e) => { e.stopPropagation(); handleDelete(branch.name); }}
                      >
                        确认
                      </button>
                      <button
                        class="text-xs opacity-50 hover:opacity-80"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                      >
                        取消
                      </button>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>

          <Show when={remoteBranches().length > 0}>
            <div class="px-3 py-2 text-[10px] font-semibold opacity-40 uppercase tracking-wider border-t border-white/5">远程分支</div>
            <For each={remoteBranches()}>
              {(branch) => (
                <div class="flex items-center gap-2 px-3 py-2 text-sm opacity-60">
                  <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span class="truncate flex-1">{branch.name}</span>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>

      {/* Error */}
      <Show when={error()}>
        <div class="px-3 py-2 text-xs text-red-400 border-t border-white/10 shrink-0">{error()}</div>
      </Show>

      {/* Checkout toast */}
      <div
        class="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-2 px-4 py-3 rounded-lg bg-cyan-900/90 backdrop-blur border border-cyan-500/30 shadow-lg text-sm transition-all duration-150"
        classList={{
          'opacity-100 translate-y-0': checkoutBranchName() !== null,
          'opacity-0 translate-y-2 pointer-events-none': checkoutBranchName() === null,
        }}
      >
        <svg class="w-4 h-4 animate-spin text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-cyan-100">
          正在切换到分支 <span class="font-semibold text-cyan-300">{checkoutBranchName() ?? ''}</span>...
        </span>
      </div>
    </div>
  );
};

export default BranchList;
