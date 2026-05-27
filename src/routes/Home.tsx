import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { open } from '@tauri-apps/plugin-dialog';
import { openRepo, getStatus, cloneRepo } from '../lib/tauriCommands';
import { repoStore, setRepoStore } from '../stores/repoStore';
import { githubStore } from '../stores/githubStore';
import { setDiffStore } from '../stores/diffStore';
import { addToast } from '../stores/toastStore';
import GitHubRepoList from '../components/github/GitHubRepoList';
import CreateRepoDialog from '../components/ui/CreateRepoDialog';
import { tt } from '../i18n';
import { describeError } from '../lib/gitErrorDesc';

const Home: Component = () => {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [clonePhase, setClonePhase] = createSignal<'closed' | 'enter' | 'exit'>('closed');
  const [cloneUrl, setCloneUrl] = createSignal('');
  const [clonePath, setClonePath] = createSignal('');
  const [cloneLoading, setCloneLoading] = createSignal(false);
  const [cloneError, setCloneError] = createSignal<string | null>(null);
  const [createPhase, setCreatePhase] = createSignal<'closed' | 'enter' | 'exit'>('closed');

  const handleOpenRepo = async () => {
    try {
      setError(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: tt('home.selectRepo'),
      });

      if (!selected) return;

      setRepoStore({ loading: true });
      const repoInfo = await openRepo(selected);
      setRepoStore({
        repoPath: selected,
        repoInfo,
        loading: false,
        error: null,
      });

      const statuses = await getStatus(selected);
      setDiffStore({ fileStatuses: statuses });

      navigate('/repository');
    } catch (e) {
      setRepoStore({ loading: false });
      setError(String(e));
    }
  };

  const handleClone = async () => {
    setClonePhase('enter');
    setCloneError(null);
    setCloneUrl('');
    setClonePath('');
  };

  const handleCloneClose = () => {
    setClonePhase('exit');
    setTimeout(() => setClonePhase('closed'), 120);
  };

  const handleCloneSelectPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择克隆目标目录',
    });
    if (selected) {
      setClonePath(selected);
    }
  };

  const handleCloneExecute = async () => {
    if (!cloneUrl().trim() || !clonePath().trim()) return;
    setCloneLoading(true);
    setCloneError(null);
    try {
      setRepoStore({ loading: true });
      const repoInfo = await cloneRepo(cloneUrl().trim(), clonePath().trim());
      addToast(tt('home.cloneSuccess'), 'success');
      setRepoStore({
        repoPath: repoInfo.path,
        repoInfo,
        loading: false,
        error: null,
      });
      const statuses = await getStatus(repoInfo.path);
      setDiffStore({ fileStatuses: statuses });
      setClonePhase('closed');
      navigate('/repository');
    } catch (e) {
      addToast(`${tt('home.cloneFailed')}: ${describeError(e)}`, 'error');
      setCloneError(String(describeError(e)));
      setRepoStore({ loading: false });
    } finally {
      setCloneLoading(false);
    }
  };

  const handleCreateOpen = () => {
    setCreatePhase('enter');
  };

  const handleCreateClose = () => {
    setCreatePhase('exit');
    setTimeout(() => setCreatePhase('closed'), 120);
  };

  const handleCloneFromRepo = (url: string) => {
    setCloneUrl(url);
    setClonePath('');
    setCloneError(null);
    setClonePhase('enter');
  };

  return (
    <div class="h-full w-full flex flex-col overflow-hidden">
      {/* Center section: title + tagline + buttons */}
      <div class="flex-1 flex flex-col items-center justify-center p-8">
        <div class="min-w-[560px] max-w-[70%] w-full">
          <h1 class="text-4xl font-extrabold mb-4 drop-shadow-md text-center">VaporGit</h1>
          <p class="text-lg opacity-80 text-center mb-8">
            {tt('home.tagline')}
          </p>

          {error() && (
            <div class="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
              {error()}
            </div>
          )}

          <div class="grid grid-cols-3 gap-4">
            <div
              class={`p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                repoStore.loading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={handleOpenRepo}
            >
              <h2 class="text-xl font-bold mb-2">{tt('home.openRepo')}</h2>
              <p class="opacity-70 text-sm">{tt('home.openDesc')}</p>
              <Show when={repoStore.loading}>
                <div class="mt-3 text-xs text-cyan-400">{tt('common.loading')}</div>
              </Show>
            </div>
            <div
              class={`p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                repoStore.loading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={handleClone}
            >
              <h2 class="text-xl font-bold mb-2">{tt('home.cloneRepo')}</h2>
              <p class="opacity-70 text-sm">{tt('home.cloneDesc')}</p>
            </div>
            <div
              class={`p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
                repoStore.loading ? 'opacity-50 pointer-events-none' : ''
              }`}
              onClick={handleCreateOpen}
            >
              <h2 class="text-xl font-bold mb-2">{tt('home.createRepo')}</h2>
              <p class="opacity-70 text-sm">{tt('home.createDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub repos — below center */}
      <div class="flex justify-center p-8 pt-0 min-h-0 overflow-hidden">
        <div class="min-w-[560px] max-w-[70%] w-full min-h-0 flex flex-col">
          <Show when={githubStore.authenticated}>
            <div class="mt-8 min-h-0 flex flex-col">
              <h2 class="text-lg font-bold mb-3 flex items-center gap-2 shrink-0">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {tt('github.repos')}
              </h2>
              <div class="flex-1 min-h-0 flex flex-col">
                <GitHubRepoList onClone={handleCloneFromRepo} />
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Clone dialog */}
      <Show when={clonePhase() !== 'closed'}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            class={`w-110 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
              clonePhase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
            }`}
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 class="text-sm font-bold">{tt('home.cloneRepo')}</h2>
              <button
                class="text-xs opacity-50 hover:text-red-400 transition-colors"
                onClick={handleCloneClose}
              >
                {tt('common.close')}
              </button>
            </div>
            <div class="p-4 space-y-3">
              <div>
                <label class="block text-xs font-medium mb-1 opacity-70">{tt('home.cloneUrl')}</label>
                <input
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                  placeholder="https://github.com/user/repo.git"
                  value={cloneUrl()}
                  onInput={(e) => setCloneUrl(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 opacity-70">{tt('home.cloneDest')}</label>
                <div class="flex gap-2">
                  <input
                    class="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                    placeholder={tt('home.cloneDestPlaceholder')}
                    value={clonePath()}
                    onInput={(e) => setClonePath(e.currentTarget.value)}
                  />
                  <button
                    class="px-3 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    onClick={handleCloneSelectPath}
                  >
                    {tt('common.browse')}
                  </button>
                </div>
              </div>
              <Show when={cloneError()}>
                <div class="p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
                  {cloneError()}
                </div>
              </Show>
              <button
                class="w-full py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
                onClick={handleCloneExecute}
                disabled={cloneLoading() || !cloneUrl().trim() || !clonePath().trim()}
              >
                {cloneLoading() ? tt('home.cloning') : tt('home.startClone')}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Create repo dialog */}
      <Show when={createPhase() !== 'closed'}>
        <CreateRepoDialog
          phase={createPhase()}
          onClose={handleCreateClose}
          onNavigate={() => navigate('/repository')}
        />
      </Show>
    </div>
  );
};

export default Home;