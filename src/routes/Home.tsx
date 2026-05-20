import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { open } from '@tauri-apps/plugin-dialog';
import { openRepo, getRecentRepos, getStatus } from '../lib/tauriCommands';
import type { RecentRepo } from '../lib/types';
import { repoStore, setRepoStore } from '../stores/repoStore';
import { setDiffStore } from '../stores/diffStore';

const Home: Component = () => {
  const navigate = useNavigate();
  const [recentRepos, setRecentRepos] = createSignal<RecentRepo[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const repos = await getRecentRepos();
      setRecentRepos(repos);
    } catch {
      // No recent repos yet
    }
  });

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

      const repos = await getRecentRepos();
      setRecentRepos(repos);

      navigate('/repository');
    } catch (e) {
      setRepoStore({ loading: false });
      setError(String(e));
    }
  };

  const handleRecentClick = async (repo: RecentRepo) => {
    try {
      setError(null);
      setRepoStore({ loading: true });

      const repoInfo = await openRepo(repo.path);
      setRepoStore({
        repoPath: repo.path,
        repoInfo,
        loading: false,
        error: null,
      });

      const statuses = await getStatus(repo.path);
      setDiffStore({ fileStatuses: statuses });

      const repos = await getRecentRepos();
      setRecentRepos(repos);

      navigate('/repository');
    } catch (e) {
      setRepoStore({ loading: false });
      setError(String(e));
    }
  };

  const handleClone = async () => {
    // Clone functionality will be added in M3
  };

  return (
    <div class="h-full w-full p-8 flex flex-col">
      <h1 class="text-4xl font-extrabold mb-4 drop-shadow-md">VaporGit 主页</h1>
      <p class="text-lg opacity-80">
        欢迎使用 VaporGit！这里是你的跨平台极简 Git 管理中心。
      </p>

      {error() && (
        <div class="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm">
          {error()}
        </div>
      )}

      <div class="mt-8 grid grid-cols-2 gap-6">
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
          <span class="mt-2 inline-block text-xs opacity-40 bg-white/10 px-2 py-0.5 rounded">M3 实现</span>
        </div>
      </div>

      {recentRepos().length > 0 && (
        <div class="mt-8">
          <h2 class="text-lg font-semibold mb-3 opacity-80">最近打开的仓库</h2>
          <div class="space-y-2">
            <For each={recentRepos()}>
              {(repo) => (
                <div
                  class={`p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-between ${
                    repoStore.loading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  onClick={() => handleRecentClick(repo)}
                >
                  <div>
                    <span class="font-medium">{repo.name}</span>
                    <span class="ml-3 text-xs opacity-50">{repo.path}</span>
                  </div>
                  <span class="text-xs opacity-40">{repo.lastOpened}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
