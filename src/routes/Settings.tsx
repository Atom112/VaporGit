import { Component } from 'solid-js';
import { settingsStore, updateSettings } from '../stores/settingsStore';
import { githubStore, clearAuth } from '../stores/githubStore';
import { githubLogout, checkUpdate } from '../lib/tauriCommands';
import { showUpdate } from '../stores/updateStore';
import { addToast } from '../stores/toastStore';
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

  const handleCheckUpdate = async () => {
    try {
      const update = await checkUpdate();
      if (update) {
        showUpdate(update);
        addToast(tt('toast.updateFound'), 'success');
      } else {
        addToast(tt('toast.updateNotFound'), 'info');
      }
    } catch {
      addToast(tt('toast.updateCheckError'), 'error');
    }
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
            <CustomSelect
              value={i18nState.lang}
              onChange={(v) => setLang(v as any)}
              options={[
                { value: 'zh-CN', label: tt('settings.langZh') },
                { value: 'zh-TW', label: tt('settings.langZhTW') },
                { value: 'en', label: tt('settings.langEn') },
                { value: 'ja', label: tt('settings.langJa') },
                { value: 'ko', label: tt('settings.langKo') },
                { value: 'fr', label: tt('settings.langFr') },
                { value: 'de', label: tt('settings.langDe') },
                { value: 'ar', label: tt('settings.langAr') },
                { value: 'es', label: tt('settings.langEs') },
                { value: 'pt', label: tt('settings.langPt') },
                { value: 'ru', label: tt('settings.langRu') },
              ]}
            />
          </div>

          {/* Theme */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <label class="block text-sm font-medium mb-3">{tt('settings.theme')}</label>
            <div class="flex gap-2">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  onClick={() => updateSettings({ theme: t })}
                  class={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                    settingsStore.theme === t
                      ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-400/50'
                      : 'bg-white/10 text-gray-400 border border-white/10 hover:bg-white/20'
                  }`}
                >
                  {tt(`settings.theme${t.charAt(0).toUpperCase() + t.slice(1)}` as any)}
                </button>
              ))}
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

          {/* Check for updates */}
          <div class="pt-2">
            <button
              onClick={handleCheckUpdate}
              class="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              {tt('settings.checkUpdate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
