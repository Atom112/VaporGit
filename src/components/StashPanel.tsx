import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { stashSave, stashList, stashPop, stashApply, stashDrop } from '../lib/tauriCommands';
import { addToast } from '../stores/toastStore';
import type { StashInfo } from '../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const StashPanel: Component<Props> = (props) => {
  const [stashes, setStashes] = createSignal<StashInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [actionLoading, setActionLoading] = createSignal<number | null>(null);
  const [saveMessage, setSaveMessage] = createSignal('');
  const [saveLoading, setSaveLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  const loadStashes = async () => {
    setLoading(true);
    try {
      const list = await stashList(props.repoPath);
      setStashes(list);
    } catch (e) {
      console.error('Failed to load stashes:', e);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.repoPath) {
      loadStashes();
    }
  });

  const handleSave = async () => {
    setSaveLoading(true);
    setError(null);
    try {
      await stashSave(props.repoPath, saveMessage() || undefined);
      setSaveMessage('');
      addToast('Stash 保存成功', 'success');
      await loadStashes();
      props.onRefresh();
    } catch (e) {
      addToast(`Stash 失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePop = async (index: number) => {
    setActionLoading(index);
    setError(null);
    try {
      await stashPop(props.repoPath, index);
      addToast('Stash 弹出成功', 'success');
      await loadStashes();
      props.onRefresh();
    } catch (e) {
      addToast(`Stash 弹出失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApply = async (index: number) => {
    setActionLoading(index);
    setError(null);
    try {
      await stashApply(props.repoPath, index);
      addToast('Stash 应用成功', 'success');
      props.onRefresh();
    } catch (e) {
      addToast(`Stash 应用失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDrop = async (index: number) => {
    setActionLoading(index);
    setError(null);
    try {
      await stashDrop(props.repoPath, index);
      addToast('Stash 已删除', 'success');
      await loadStashes();
    } catch (e) {
      addToast(`Stash 删除失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-120 max-h-[80vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">Stash 管理</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            关闭
          </button>
        </div>

        {/* Save area */}
        <div class="px-4 py-3 border-b border-white/10">
          <div class="flex gap-2">
            <input
              class="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder="暂存描述（可选）"
              value={saveMessage()}
              onInput={(e) => setSaveMessage(e.currentTarget.value)}
            />
            <button
              class="px-3 py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors shrink-0"
              onClick={handleSave}
              disabled={saveLoading()}
            >
              {saveLoading() ? '保存中...' : '保存暂存'}
            </button>
          </div>
          {error() && (
            <div class="mt-2 text-xs text-red-400">{error()}</div>
          )}
        </div>

        {/* Stash list */}
        <div class="flex-1 overflow-auto p-4">
          <Show
            when={!loading()}
            fallback={
              <div class="flex items-center justify-center py-8 text-sm opacity-40">加载中...</div>
            }
          >
            <Show
              when={stashes().length > 0}
              fallback={
                <div class="flex items-center justify-center py-8 text-sm opacity-40">暂无暂存记录</div>
              }
            >
              <div class="space-y-2">
                <For each={stashes()}>
                  {(stash) => (
                    <div class="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium truncate">{stash.message}</div>
                          <div class="text-xs opacity-40 mt-1">
                            WIP-{stash.index} · {new Date(stash.timestamp * 1000).toLocaleString('zh-CN')}
                          </div>
                        </div>
                        <div class="flex gap-1 shrink-0">
                          <button
                            class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors"
                            onClick={() => handleApply(stash.index)}
                            disabled={actionLoading() === stash.index}
                          >
                            应用
                          </button>
                          <button
                            class="px-2 py-1 text-xs rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 disabled:opacity-30 transition-colors"
                            onClick={() => handlePop(stash.index)}
                            disabled={actionLoading() === stash.index}
                          >
                            弹出
                          </button>
                          <button
                            class="px-2 py-1 text-xs rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-30 transition-colors"
                            onClick={() => handleDrop(stash.index)}
                            disabled={actionLoading() === stash.index}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default StashPanel;
