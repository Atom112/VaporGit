import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { getConflicts, resolveConflict } from '../lib/tauriCommands';
import { addToast } from '../stores/toastStore';
import type { ConflictEntry } from '../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const ConflictResolver: Component<Props> = (props) => {
  const [conflicts, setConflicts] = createSignal<ConflictEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [resolving, setResolving] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const list = await getConflicts(props.repoPath);
      setConflicts(list);
      if (list.length === 0) props.onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadConflicts();
  });

  const handleResolve = async (file: string, resolution: string) => {
    setResolving(file);
    setError(null);
    try {
      await resolveConflict(props.repoPath, file, resolution);
      addToast(`冲突已解决: ${file}`, 'success');
      await loadConflicts();
      props.onRefresh();
    } catch (e) {
      addToast(`冲突解决失败: ${e}`, 'error');
      setError(String(e));
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: string) => {
    const current = conflicts();
    for (const c of current) {
      try {
        await resolveConflict(props.repoPath, c.filePath, resolution);
      } catch (e) {
        addToast(`冲突解决失败: ${e}`, 'error');
        setError(String(e));
      }
    }
    await loadConflicts();
    props.onRefresh();
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="w-[500px] max-h-[70vh] flex flex-col rounded-xl bg-white/10 backdrop-blur-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold text-yellow-300">冲突文件</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>

        {error() && (
          <div class="mx-4 mt-3 p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
            {error()}
          </div>
        )}

        {/* Batch actions */}
        <Show when={conflicts().length > 1}>
          <div class="flex gap-2 px-4 pt-3">
            <button
              class="flex-1 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
              onClick={() => handleResolveAll('ours')}
            >
              全部使用 ours
            </button>
            <button
              class="flex-1 py-1.5 text-xs rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
              onClick={() => handleResolveAll('theirs')}
            >
              全部使用 theirs
            </button>
          </div>
        </Show>

        {/* Conflict list */}
        <div class="flex-1 overflow-auto p-4">
          <Show
            when={!loading()}
            fallback={
              <div class="flex items-center justify-center py-8 text-sm opacity-40">加载中...</div>
            }
          >
            <Show
              when={conflicts().length > 0}
              fallback={
                <div class="flex items-center justify-center py-8 text-sm opacity-40">没有冲突文件</div>
              }
            >
              <div class="space-y-2">
                <For each={conflicts()}>
                  {(conflict) => (
                    <div class="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-mono truncate">{conflict.filePath}</div>
                        </div>
                        <div class="flex gap-1 shrink-0">
                          <button
                            class="px-2 py-1 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                            onClick={() => handleResolve(conflict.filePath, 'ours')}
                            disabled={resolving() === conflict.filePath}
                          >
                            使用 ours
                          </button>
                          <button
                            class="px-2 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 disabled:opacity-30 transition-colors"
                            onClick={() => handleResolve(conflict.filePath, 'theirs')}
                            disabled={resolving() === conflict.filePath}
                          >
                            使用 theirs
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

export default ConflictResolver;
