import { Component } from 'solid-js';
import { settingsStore, updateSettings } from '../stores/settingsStore';
import { githubStore, clearAuth } from '../stores/githubStore';
import { githubLogout } from '../lib/tauriCommands';
import CustomSelect from '../components/CustomSelect';
import GitHubLogin from '../components/GitHubLogin';

const Settings: Component = () => {
  const handleLogout = async () => {
    try {
      await githubLogout();
    } catch {
      // ignore
    }
    clearAuth();
  };

  return (
    <div class="h-full w-full p-8 overflow-auto animate-tree-enter">
      <div class="max-w-lg mx-auto">
        <h1 class="text-2xl font-bold mb-6">设置</h1>

        <div class="space-y-6">
          {/* GitHub Account */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <h2 class="text-sm font-medium mb-3">GitHub 账户</h2>
            {githubStore.authenticated && githubStore.user ? (
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  {githubStore.user.avatarUrl ? (
                    <img src={githubStore.user.avatarUrl} alt="" class="w-10 h-10 rounded-full" />
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span class="text-lg text-cyan-400 font-medium">
                        {githubStore.user.login?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p class="text-sm text-white font-medium">{githubStore.user.name ?? githubStore.user.login}</p>
                    <p class="text-xs text-gray-400">{githubStore.user.login}</p>
                    {githubStore.user.email && (
                      <p class="text-xs text-gray-500">{githubStore.user.email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  class="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <GitHubLogin />
            )}
          </div>

          {/* Default diff view */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">默认 Diff 视图</label>
            <CustomSelect
              value={settingsStore.defaultDiffView}
              onChange={(v) => updateSettings({ defaultDiffView: v as any })}
              options={[
                { value: 'unified', label: 'Unified（统一视图）' },
                { value: 'split', label: 'Split（分割视图）' },
                { value: 'fullFile', label: 'Full File（完整文件）' },
              ]}
            />
          </div>

          {/* Default remote name */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">默认远程名称</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder="origin"
              value={settingsStore.defaultRemoteName}
              onInput={(e) => updateSettings({ defaultRemoteName: e.currentTarget.value })}
            />
            <p class="text-xs opacity-40 mt-1">用于 Fetch/Pull/Push 操作的默认远程仓库</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
