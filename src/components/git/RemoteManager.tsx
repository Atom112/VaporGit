import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { getRemotes, addRemote, setRemoteUrl, deleteRemote } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { RemoteInfo } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const RemoteManager: Component<Props> = (props) => {
  const [remotes, setRemotes] = createSignal<RemoteInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');

  // Add remote form
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newUrl, setNewUrl] = createSignal('');
  const [addLoading, setAddLoading] = createSignal(false);

  // Edit URL state
  const [editingRemote, setEditingRemote] = createSignal<string | null>(null);
  const [editUrl, setEditUrl] = createSignal('');
  const [editLoading, setEditLoading] = createSignal(false);

  // Delete confirm
  const [deletingRemote, setDeletingRemote] = createSignal<string | null>(null);
  const [deleteLoading, setDeleteLoading] = createSignal(false);

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  const loadRemotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getRemotes(props.repoPath);
      setRemotes(list);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (props.repoPath) {
      loadRemotes();
    }
  });

  const handleAdd = async () => {
    if (!newName().trim() || !newUrl().trim()) return;
    setAddLoading(true);
    setError(null);
    try {
      await addRemote(props.repoPath, newName().trim(), newUrl().trim());
      addToast(tt('repo.remoteAdded'), 'success');
      setNewName('');
      setNewUrl('');
      setShowAddForm(false);
      await loadRemotes();
      props.onRefresh?.();
    } catch (e) {
      addToast(ttf('repo.remoteActionFailed', describeError(e)), 'error');
      setError(describeError(e));
    } finally {
      setAddLoading(false);
    }
  };

  const handleStartEdit = (remote: RemoteInfo) => {
    setEditingRemote(remote.name);
    setEditUrl(remote.pushUrl || remote.url);
  };

  const handleSaveEdit = async () => {
    const name = editingRemote();
    if (!name || !editUrl().trim()) return;
    setEditLoading(true);
    setError(null);
    try {
      await setRemoteUrl(props.repoPath, name, editUrl().trim());
      addToast(tt('repo.remoteUrlUpdated'), 'success');
      setEditingRemote(null);
      await loadRemotes();
    } catch (e) {
      addToast(ttf('repo.remoteActionFailed', describeError(e)), 'error');
      setError(describeError(e));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    setDeletingRemote(name);
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteRemote(props.repoPath, name);
      addToast(tt('repo.remoteDeleted'), 'success');
      await loadRemotes();
      props.onRefresh?.();
    } catch (e) {
      addToast(ttf('repo.remoteActionFailed', describeError(e)), 'error');
      setError(describeError(e));
    } finally {
      setDeleteLoading(false);
      setDeletingRemote(null);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class={`w-120 max-h-[80vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">{tt('repo.remotes')}</h2>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={handleClose}
          >
            {tt('common.close')}
          </button>
        </div>

        {/* Add remote button / form */}
        <div class="px-4 py-3 border-b border-white/10">
          <Show
            when={showAddForm()}
            fallback={
              <button
                class="w-full py-1.5 px-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-sm font-medium transition-colors"
                onClick={() => setShowAddForm(true)}
              >
                + {tt('repo.addRemote')}
              </button>
            }
          >
            <div class="space-y-2">
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('repo.remoteNamePlaceholder')}
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
              />
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('repo.remoteUrlPlaceholder')}
                value={newUrl()}
                onInput={(e) => setNewUrl(e.currentTarget.value)}
              />
              <div class="flex gap-2">
                <button
                  class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                  onClick={handleAdd}
                  disabled={addLoading() || !newName().trim() || !newUrl().trim()}
                >
                  {addLoading() ? tt('common.loading') : tt('common.confirm')}
                </button>
                <button
                  class="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                  onClick={() => { setShowAddForm(false); setNewName(''); setNewUrl(''); }}
                >
                  {tt('common.cancel')}
                </button>
              </div>
            </div>
          </Show>
        </div>

        {/* Remote list */}
        <div class="flex-1 overflow-auto p-4">
          <Show
            when={!loading()}
            fallback={
              <div class="flex items-center justify-center py-8 text-sm opacity-40">{tt('common.loading')}</div>
            }
          >
            <Show
              when={remotes().length > 0}
              fallback={
                <div class="flex items-center justify-center py-8 text-sm opacity-40">{tt('repo.noRemotes')}</div>
              }
            >
              <div class="space-y-2">
                <For each={remotes()}>
                  {(remote) => (
                    <div class="p-3 rounded-lg bg-white/5 border border-white/10">
                      <Show
                        when={editingRemote() === remote.name}
                        fallback={
                          <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                              <div class="text-sm font-medium">{remote.name}</div>
                              <div class="text-xs opacity-40 mt-1 truncate">{remote.url}</div>
                              {remote.pushUrl !== remote.url && (
                                <div class="text-xs opacity-30 mt-0.5 truncate">push: {remote.pushUrl}</div>
                              )}
                            </div>
                            <div class="flex gap-1 shrink-0">
                              <button
                                class="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition-colors"
                                onClick={() => handleStartEdit(remote)}
                              >
                                {tt('repo.editRemoteUrl')}
                              </button>
                              <button
                                class="px-2 py-1 text-xs rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-30 transition-colors"
                                onClick={() => handleDelete(remote.name)}
                                disabled={deletingRemote() === remote.name && deleteLoading()}
                              >
                                {deletingRemote() === remote.name && deleteLoading() ? tt('common.loading') : tt('repo.deleteRemote')}
                              </button>
                            </div>
                          </div>
                        }
                      >
                        <div class="space-y-2">
                          <div class="text-sm font-medium">{remote.name}</div>
                          <input
                            class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                            value={editUrl()}
                            onInput={(e) => setEditUrl(e.currentTarget.value)}
                          />
                          <div class="flex gap-2">
                            <button
                              class="px-3 py-1 text-xs rounded bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 transition-colors"
                              onClick={handleSaveEdit}
                              disabled={editLoading() || !editUrl().trim()}
                            >
                              {editLoading() ? tt('common.loading') : tt('common.save')}
                            </button>
                            <button
                              class="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition-colors"
                              onClick={() => setEditingRemote(null)}
                            >
                              {tt('common.cancel')}
                            </button>
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* Error display */}
        {error() && (
          <div class="px-4 py-2 border-t border-white/10">
            <div class="text-xs text-red-400">{error()}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RemoteManager;
