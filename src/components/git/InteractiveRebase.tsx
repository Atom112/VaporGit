import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import {
  cherryPick,
  getBranchList,
  listRebaseCommits,
  performInteractiveRebase,
} from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt } from '../../i18n';
import type { BranchInfo, RebaseEntry } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const InteractiveRebase: Component<Props> = (props) => {
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');
  const [tab, setTab] = createSignal<'rebase' | 'cherrypick'>('rebase');
  const [branches, setBranches] = createSignal<BranchInfo[]>([]);
  const [branchesLoading, setBranchesLoading] = createSignal(false);

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  // ── Interactive Rebase ──
  const [targetBranch, setTargetBranch] = createSignal('');
  const [entries, setEntries] = createSignal<RebaseEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = createSignal(false);
  const [rebaseLoading, setRebaseLoading] = createSignal(false);
  const [rebaseResult, setRebaseResult] = createSignal<string | null>(null);

  // Load branches
  createEffect(() => {
    if (!props.repoPath) return;
    setBranchesLoading(true);
    getBranchList(props.repoPath)
      .then((list) => {
        setBranches(list);
        const alt = list.find((b) => !b.isHead && !b.isRemote);
        if (alt) setTargetBranch(alt.name);
      })
      .catch((e) => {
        addToast(`加载分支列表失败: ${e}`, 'error');
      })
      .finally(() => setBranchesLoading(false));
  });

  // Load commits when target branch changes
  const handleTargetChange = async (branch: string) => {
    setTargetBranch(branch);
    if (!branch) return;
    setEntriesLoading(true);
    setRebaseResult(null);
    try {
      const result = await listRebaseCommits(props.repoPath, branch);
      setEntries(result);
    } catch (e) {
      addToast(`加载变基提交列表失败: ${e}`, 'error');
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  };

  const updateEntryAction = (index: number, action: RebaseEntry['action']) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], action };
      if (action !== 'reword') {
        next[index] = { ...next[index], newMessage: null };
      }
      return next;
    });
  };

  const updateEntryMessage = (index: number, msg: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], newMessage: msg };
      return next;
    });
  };

  const handleRebase = async () => {
    if (!targetBranch()) return;
    setRebaseLoading(true);
    setRebaseResult(null);
    try {
      const result = await performInteractiveRebase(props.repoPath, targetBranch(), entries());
      setRebaseResult(result);
      addToast(result, 'success');
      props.onRefresh();
    } catch (e) {
      const msg = `变基失败: ${e}`;
      setRebaseResult(msg);
      addToast(msg, 'error');
    } finally {
      setRebaseLoading(false);
    }
  };

  // ── Cherry-pick ──
  const [commitId, setCommitId] = createSignal('');
  const [cpLoading, setCpLoading] = createSignal(false);

  const handleCherryPick = async () => {
    if (!commitId().trim()) return;
    setCpLoading(true);
    try {
      const result = await cherryPick(props.repoPath, commitId().trim());
      addToast(result, 'success');
      props.onRefresh();
    } catch (e) {
      addToast(`Cherry-pick 失败: ${e}`, 'error');
    } finally {
      setCpLoading(false);
    }
  };

  const actionOptions: { value: RebaseEntry['action']; label: string }[] = [
    { value: 'pick', label: tt('repo.rebasePick') },
    { value: 'squash', label: tt('repo.rebaseSquash') },
    { value: 'fixup', label: tt('repo.rebaseFixup') },
    { value: 'reword', label: tt('repo.rebaseReword') },
    { value: 'drop', label: tt('repo.rebaseDrop') },
  ];

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-140 max-h-[85vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">{tt('repo.interactiveRebase')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            {tt('common.close')}
          </button>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-white/10 shrink-0">
          <button
            class={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab() === 'rebase'
                ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => setTab('rebase')}
          >
            {tt('repo.interactiveRebase')}
          </button>
          <button
            class={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab() === 'cherrypick'
                ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => setTab('cherrypick')}
          >
            Cherry-pick
          </button>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 p-4">
          <Show when={tab() === 'rebase'}>
            <div class="space-y-4">
              {/* Target branch selector */}
              <div>
                <label class="block text-xs font-medium mb-1.5 opacity-70">{tt('repo.rebaseSelectTarget')}</label>
                <Show
                  when={!branchesLoading()}
                  fallback={<div class="text-xs opacity-40">{tt('common.loading')}</div>}
                >
                  <select
                    class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                    value={targetBranch()}
                    onChange={(e) => handleTargetChange(e.currentTarget.value)}
                  >
                    <option value="" disabled class="bg-[#4a4a4e]">{tt('repo.rebaseSelectTarget')}</option>
                    <For each={branches()}>
                      {(b) => (
                        <option value={b.name} class="bg-[#4a4a4e]">{b.name}{b.isHead ? ' (HEAD)' : ''}{b.isRemote ? ' (remote)' : ''}</option>
                      )}
                    </For>
                  </select>
                </Show>
              </div>

              {/* Commit list */}
              <Show when={entriesLoading()}>
                <div class="text-xs opacity-40 text-center py-4">{tt('common.loading')}</div>
              </Show>

              <Show when={!entriesLoading() && targetBranch() && entries().length === 0}>
                <div class="text-xs opacity-60 text-center py-4">{tt('repo.rebaseNoCommits')}</div>
              </Show>

              <Show when={entries().length > 0}>
                <div>
                  <div class="text-xs font-medium mb-2 opacity-70">
                    {tt('repo.rebaseCommits')}
                    {entries().filter((e) => e.action === 'drop').length > 0 && (
                      <span class="text-red-400 ml-2">
                        ({entries().filter((e) => e.action === 'drop').length} dropped)
                      </span>
                    )}
                  </div>

                  {/* Header row */}
                  <div class="flex items-center gap-2 px-2 py-1 text-[10px] text-white/40 font-medium border-b border-white/10">
                    <span class="w-16 shrink-0">{tt('repo.rebaseAction')}</span>
                    <span class="w-20 shrink-0 font-mono">SHA</span>
                    <span class="flex-1 min-w-0">{tt('commit.message')}</span>
                    <span class="w-20 shrink-0 text-right">{tt('commit.author')}</span>
                  </div>

                  {/* Entries */}
                  <div class="max-h-64 overflow-y-auto space-y-0.5">
                    <For each={entries()}>
                      {(entry, idx) => (
                        <div class="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors text-xs border-b border-white/5">
                          {/* Action selector */}
                          <div class="w-16 shrink-0">
                            <select
                              class="w-full p-0.5 rounded bg-white/10 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-400/50"
                              value={entry.action}
                              onChange={(e) => updateEntryAction(idx(), e.currentTarget.value as RebaseEntry['action'])}
                            >
                              <For each={actionOptions}>
                                {(opt) => (
                                  <option value={opt.value} class="bg-[#4a4a4e]">{opt.label}</option>
                                )}
                              </For>
                            </select>
                          </div>

                          {/* SHA */}
                          <span class="w-20 shrink-0 font-mono text-cyan-400/70">{entry.shortId}</span>

                          {/* Message + reword input */}
                          <div class="flex-1 min-w-0 space-y-1">
                            <div class="truncate">{entry.message}</div>
                            <Show when={entry.action === 'reword'}>
                              <input
                                class="w-full p-1 rounded bg-white/10 border border-white/10 text-white text-[10px] focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                                placeholder="New commit message..."
                                value={entry.newMessage ?? entry.message}
                                onInput={(e) => updateEntryMessage(idx(), e.currentTarget.value)}
                              />
                            </Show>
                          </div>

                          {/* Author */}
                          <span class="w-20 shrink-0 text-right text-white/40 truncate">{entry.author}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Result */}
              <Show when={rebaseResult()}>
                <div class={`p-3 rounded-lg text-sm ${
                  rebaseResult()?.includes('失败') || rebaseResult()?.includes('冲突')
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-green-500/20 text-green-300'
                }`}>
                  {rebaseResult()}
                </div>
              </Show>

              {/* Actions */}
              <Show when={entries().length > 0}>
                <div class="flex gap-2 pt-2">
                  <button
                    class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                    onClick={handleRebase}
                    disabled={rebaseLoading() || entries().filter((e) => e.action !== 'drop').length === 0}
                  >
                    {rebaseLoading() ? tt('repo.rebasePerforming') : tt('repo.rebase')}
                  </button>
                  <button
                    class="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                    onClick={handleClose}
                  >
                    {tt('common.cancel')}
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={tab() === 'cherrypick'}>
            <div class="space-y-3">
              <p class="text-xs opacity-60">{tt('commit.cherryPick')}</p>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('commit.copySHA')}
                value={commitId()}
                onInput={(e) => setCommitId(e.currentTarget.value)}
              />
              <button
                class="w-full py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                onClick={handleCherryPick}
                disabled={cpLoading() || !commitId().trim()}
              >
                {cpLoading() ? tt('common.loading') : tt('commit.cherryPick')}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default InteractiveRebase;
