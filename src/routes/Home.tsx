import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { open } from '@tauri-apps/plugin-dialog';
import { openRepo, getStatus, cloneRepo } from '../lib/tauriCommands';
import { repoStore, setRepoStore } from '../stores/repoStore';
import { setDiffStore } from '../stores/diffStore';
import { addToast } from '../stores/toastStore';

const Home: Component = () => {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);
  const [clonePhase, setClonePhase] = createSignal<'closed' | 'enter' | 'exit'>('closed');
  const [cloneUrl, setCloneUrl] = createSignal('');
  const [clonePath, setClonePath] = createSignal('');
  const [cloneLoading, setCloneLoading] = createSignal(false);
  const [cloneError, setCloneError] = createSignal<string | null>(null);

  const handleOpenRepo = async () => {
    try {
      setError(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Git 仓库目录',
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
      addToast('克隆成功', 'success');
      setRepoStore({
        repoPath: clonePath().trim(),
        repoInfo,
        loading: false,
        error: null,
      });
      const statuses = await getStatus(clonePath().trim());
      setDiffStore({ fileStatuses: statuses });
      setClonePhase('closed');
      navigate('/repository');
    } catch (e) {
      addToast(`克隆失败: ${e}`, 'error');
      setCloneError(String(e));
      setRepoStore({ loading: false });
    } finally {
      setCloneLoading(false);
    }
  };

  return (
    <div class="h-full w-full p-8 flex flex-col items-center justify-center">
      <div class="max-w-xl w-full">
        <h1 class="text-4xl font-extrabold mb-4 drop-shadow-md text-center">VaporGit</h1>
        <p class="text-lg opacity-80 text-center mb-8">
          跨平台极简 Git 客户端
        </p>

        {error() && (
          <div class="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
            {error()}
          </div>
        )}

        <div class="grid grid-cols-2 gap-6">
          <div
            class={`p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
              repoStore.loading ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={handleOpenRepo}
          >
            <h2 class="text-xl font-bold mb-2">打开仓库</h2>
            <p class="opacity-70 text-sm">浏览本地文件夹并打开一个现有的 Git 仓库</p>
            <Show when={repoStore.loading}>
              <div class="mt-3 text-xs text-cyan-400">正在加载...</div>
            </Show>
          </div>
          <div
            class={`p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer shadow-lg backdrop-blur-sm ${
              repoStore.loading ? 'opacity-50 pointer-events-none' : ''
            }`}
            onClick={handleClone}
          >
            <h2 class="text-xl font-bold mb-2">克隆仓库</h2>
            <p class="opacity-70 text-sm">从远程 URL 下载一个新的 Git 仓库到本地</p>
          </div>
        </div>
      </div>

      {/* Clone dialog */}
      <Show when={clonePhase() !== 'closed'}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            class={`w-[440px] rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
              clonePhase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
            }`}
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 class="text-sm font-bold">克隆仓库</h2>
              <button
                class="text-xs opacity-50 hover:text-red-400 transition-colors"
                onClick={handleCloneClose}
              >
                关闭
              </button>
            </div>
            <div class="p-4 space-y-3">
              <div>
                <label class="block text-xs font-medium mb-1 opacity-70">仓库 URL</label>
                <input
                  class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                  placeholder="https://github.com/user/repo.git"
                  value={cloneUrl()}
                  onInput={(e) => setCloneUrl(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 opacity-70">目标目录</label>
                <div class="flex gap-2">
                  <input
                    class="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                    placeholder="选择本地目录"
                    value={clonePath()}
                    onInput={(e) => setClonePath(e.currentTarget.value)}
                  />
                  <button
                    class="px-3 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    onClick={handleCloneSelectPath}
                  >
                    浏览
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
                {cloneLoading() ? '克隆中...' : '开始克隆'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Home;
