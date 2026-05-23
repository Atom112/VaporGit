import { Component } from 'solid-js';
import { settingsStore, updateSettings } from '../stores/settingsStore';
import { githubStore, clearAuth } from '../stores/githubStore';
import { githubLogout } from '../lib/tauriCommands';
import CustomSelect from '../components/CustomSelect';
import GitHubLogin from '../components/GitHubLogin';
import { i18nState, setLang, tt } from '../i18n';

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
        <h1 class="text-2xl font-bold mb-6">{tt('settings.title')}</h1>

        <div class="space-y-6">
          {/* GitHub Account */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <h2 class="text-sm font-medium mb-3">{tt('settings.github')}</h2>
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
                  {tt('github.logout')}
                </button>
              </div>
            ) : (
              <GitHubLogin />
            )}
          </div>

          {/* Language */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">{tt('settings.language')}</label>
            <div class="flex gap-2">
              <button
                class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  i18nState.lang === 'zh-CN'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/30'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 border border-transparent'
                }`}
                onClick={() => setLang('zh-CN')}
              >
                {tt('settings.langZh')}
              </button>
              <button
                class={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  i18nState.lang === 'en'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/30'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 border border-transparent'
                }`}
                onClick={() => setLang('en')}
              >
                {tt('settings.langEn')}
              </button>
            </div>
          </div>

          {/* Default diff view */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">{tt('settings.diffView')}</label>
            <CustomSelect
              value={settingsStore.defaultDiffView}
              onChange={(v) => updateSettings({ defaultDiffView: v as any })}
              options={[
                { value: 'unified', label: tt('settings.diffViewUnified') },
                { value: 'split', label: tt('settings.diffViewSplit') },
                { value: 'fullFile', label: tt('settings.diffViewFullFile') },
              ]}
            />
          </div>

          {/* Default remote name */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-2">{tt('settings.remoteName')}</label>
            <input
              class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
              placeholder={tt('settings.remoteNamePlaceholder')}
              value={settingsStore.defaultRemoteName}
              onInput={(e) => updateSettings({ defaultRemoteName: e.currentTarget.value })}
            />
            <p class="text-xs opacity-40 mt-1">{tt('settings.remoteNameDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
