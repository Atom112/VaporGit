import { Component, createSignal, Show } from 'solid-js';
import { settingsStore, updateSettings, resetTutorial } from '../stores/settingsStore';
import { githubStore, clearAuth } from '../stores/githubStore';
import { giteeStore, clearGiteeAuth } from '../stores/giteeStore';
import { githubLogout, giteeLogout, checkUpdate } from '../lib/tauriCommands';
import { startTutorial } from '../stores/tutorialStore';
import { showUpdate } from '../stores/updateStore';
import { addToast } from '../stores/toastStore';
import CustomSelect from '../components/ui/CustomSelect';
import GitHubLogin from '../components/github/GitHubLogin';
import GiteeLogin from '../components/gitee/GiteeLogin';
import { version } from '../../package.json';
import { i18nState, setLang, tt } from '../i18n';

const Settings: Component = () => {
  const [checking, setChecking] = createSignal(false);

  const handleSwitchAccount = async () => {
    if (githubStore.authenticated) {
      try { await githubLogout(); } catch { /* ignore */ }
      clearAuth();
    }
    if (giteeStore.authenticated) {
      try { await giteeLogout(); } catch { /* ignore */ }
      clearGiteeAuth();
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
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
    } finally {
      setChecking(false);
    }
  };

  return (
    <div class="h-full w-full p-8 overflow-auto animate-tree-enter">
      <div class="max-w-lg mx-auto">
        <h1 class="text-2xl font-bold mb-6">{tt('settings.title')}</h1>

        <div class="space-y-6">
          {/* Platform Account */}
          <div class="p-4 rounded-xl bg-white/5 border border-white/10">
            <h2 class="text-sm font-medium mb-3">{tt('settings.account')}</h2>

            {/* Logged into GitHub */}
            <Show when={githubStore.authenticated && githubStore.user}>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  {githubStore.user!.avatarUrl ? (
                    <img src={githubStore.user!.avatarUrl} alt="" class="w-10 h-10 rounded-full" />
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <span class="text-lg text-cyan-400 font-medium">
                        {githubStore.user!.login?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p class="text-sm text-white font-medium">{githubStore.user!.name ?? githubStore.user!.login}</p>
                    <p class="text-xs text-gray-400">{githubStore.user!.login}</p>
                    {githubStore.user!.email && (
                      <p class="text-xs text-gray-500">{githubStore.user!.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </Show>

            {/* Logged into Gitee */}
            <Show when={giteeStore.authenticated && giteeStore.user}>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  {giteeStore.user!.avatarUrl ? (
                    <img src={giteeStore.user!.avatarUrl} alt="" class="w-10 h-10 rounded-full" />
                  ) : (
                    <div class="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span class="text-lg text-red-400 font-medium">
                        {giteeStore.user!.login?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p class="text-sm text-white font-medium">{giteeStore.user!.name ?? giteeStore.user!.login}</p>
                    <p class="text-xs text-gray-400">{giteeStore.user!.login}</p>
                    {giteeStore.user!.email && (
                      <p class="text-xs text-gray-500">{giteeStore.user!.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </Show>

            {/* Logged in: show switch button */}
            <Show when={githubStore.authenticated || giteeStore.authenticated}>
              <div class="mt-3 flex justify-end">
                <button
                  onClick={handleSwitchAccount}
                  class="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {tt('settings.switchAccount')}
                </button>
              </div>
            </Show>

            {/* Not logged in: show both login options */}
            <Show when={!githubStore.authenticated && !giteeStore.authenticated}>
              <div class="space-y-2">
                <GitHubLogin />
                <GiteeLogin />
              </div>
            </Show>
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

          {/* Tutorial */}
          <div class="pt-2">
            <div class="p-4 rounded-xl bg-white/5 border border-white/10">
              <h2 class="text-sm font-medium mb-1">{tt('settings.tutorial')}</h2>
              <p class="text-xs opacity-60 mb-3">{tt('settings.tutorialDesc')}</p>
              <button
                class="px-4 py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 text-sm font-medium transition-colors"
                onClick={() => { resetTutorial(); startTutorial(); }}
              >
                {tt('settings.restartTutorial')}
              </button>
            </div>
          </div>

          {/* Check for updates */}
          <div class="pt-2">
            <div class="text-center text-xs text-gray-500 mb-2">
              {tt('settings.version')} {version}
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={checking()}
              class="w-full px-4 py-3 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <Show when={checking()} fallback={tt('settings.checkUpdate')}>
                <span class="inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span class="text-gray-400">{tt('settings.checkUpdate')}</span>
              </Show>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
