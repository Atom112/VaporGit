import { Component, createSignal, Show } from 'solid-js';
import { rebase, cherryPick } from '../lib/tauriCommands';
import { addToast } from '../stores/toastStore';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const InteractiveRebase: Component<Props> = (props) => {
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');
  const [tab, setTab] = createSignal<'rebase' | 'cherrypick'>('rebase');

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  // Rebase
  const [onto, setOnto] = createSignal('');
  const [rebaseLoading, setRebaseLoading] = createSignal(false);

  // Cherry-pick
  const [commitId, setCommitId] = createSignal('');
  const [cpLoading, setCpLoading] = createSignal(false);

  const handleRebase = async () => {
    if (!onto().trim()) return;
    setRebaseLoading(true);
    try {
      const result = await rebase(props.repoPath, onto().trim());
      addToast(result, 'success');
      props.onRefresh();
    } catch (e) {
      addToast(`Rebase 失败: ${e}`, 'error');
    } finally {
      setRebaseLoading(false);
    }
  };

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

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-[440px] rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 class="text-sm font-bold">Rebase / Cherry-pick</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            关闭
          </button>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-white/10">
          <button
            class={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab() === 'rebase'
                ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                : 'opacity-50 hover:opacity-80'
            }`}
            onClick={() => setTab('rebase')}
          >
            Rebase
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

        <div class="p-4">
          <Show when={tab() === 'rebase'}>
            <div class="space-y-3">
              <p class="text-xs opacity-60">将当前分支变基到目标分支</p>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder="目标分支名（如 main）"
                value={onto()}
                onInput={(e) => setOnto(e.currentTarget.value)}
              />
              <button
                class="w-full py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                onClick={handleRebase}
                disabled={rebaseLoading() || !onto().trim()}
              >
                {rebaseLoading() ? '执行中...' : '执行 Rebase'}
              </button>
            </div>
          </Show>

          <Show when={tab() === 'cherrypick'}>
            <div class="space-y-3">
              <p class="text-xs opacity-60">将指定提交应用到当前分支</p>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder="提交 ID"
                value={commitId()}
                onInput={(e) => setCommitId(e.currentTarget.value)}
              />
              <button
                class="w-full py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                onClick={handleCherryPick}
                disabled={cpLoading() || !commitId().trim()}
              >
                {cpLoading() ? '执行中...' : '执行 Cherry-pick'}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default InteractiveRebase;
