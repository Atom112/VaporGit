import { Component, createSignal, Show } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { initRepo, githubCreateRepo, pushToGitHub, getStatus } from '../../lib/tauriCommands';
import { githubStore } from '../../stores/githubStore';
import { setRepoStore } from '../../stores/repoStore';
import { setDiffStore } from '../../stores/diffStore';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { GitHubRepo } from '../../lib/types';

interface Props {
  phase: 'closed' | 'enter' | 'exit';
  onClose: () => void;
  onNavigate: () => void;
}

const CreateRepoDialog: Component<Props> = (props) => {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [parentPath, setParentPath] = createSignal('');
  const [initReadme, setInitReadme] = createSignal(true);
  const [pushToRemote, setPushToRemote] = createSignal(false);
  const [privateRepo, setPrivateRepo] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [step, setStep] = createSignal<'init' | 'creating_github' | 'pushing'>('init');

  const isValid = () => name().trim().length > 0 && parentPath().trim().length > 0;

  const handleSelectPath = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: tt('createRepo.dialogTitle'),
    });
    if (selected) {
      setParentPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!isValid()) return;
    setLoading(true);
    setError(null);
    setStep('init');

    try {
      const fullPath = `${parentPath().replace(/\\/g, '/')}/${name().trim()}`;

      // Step 1: Initialize local repo
      setStep('init');
      const repoInfo = await initRepo(fullPath, initReadme());

      // Step 2: Create on GitHub if requested
      let githubRepo: GitHubRepo | null = null;
      if (pushToRemote() && githubStore.authenticated) {
        setStep('creating_github');
        githubRepo = await githubCreateRepo(name().trim(), description().trim() || null, privateRepo());

        // Step 3: Push to GitHub
        setStep('pushing');
        const branch = repoInfo.headBranch || 'main';
        await pushToGitHub(fullPath, githubRepo.owner.login, githubRepo.name, branch);

        addToast(ttf('createRepo.pushSuccess', githubRepo.fullName), 'success');
      } else {
        addToast(tt('createRepo.success'), 'success');
      }

      // Navigate to repository
      setRepoStore({
        repoPath: fullPath,
        repoInfo,
        loading: false,
        error: null,
      });

      const statuses = await getStatus(fullPath);
      setDiffStore({ fileStatuses: statuses });

      props.onClose();
      props.onNavigate();
    } catch (e) {
      setError(describeError(e));
      addToast(`${tt('createRepo.error')}: ${describeError(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        class={`w-110 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          props.phase === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}
      >
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h2 class="text-sm font-bold">{tt('createRepo.title')}</h2>
            <button
              class="text-xs opacity-50 hover:text-red-400 transition-colors"
              onClick={props.onClose}
              disabled={loading()}
            >
              {tt('common.close')}
            </button>
          </div>
          <div class="p-4 space-y-3">
            {/* Repository name */}
            <div>
              <label class="block text-xs font-medium mb-1 opacity-70">{tt('createRepo.name')}</label>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('createRepo.namePlaceholder')}
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                disabled={loading()}
              />
            </div>

            {/* Description */}
            <div>
              <label class="block text-xs font-medium mb-1 opacity-70">{tt('createRepo.description')}</label>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('createRepo.descPlaceholder')}
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                disabled={loading()}
              />
            </div>

            {/* Parent directory */}
            <div>
              <label class="block text-xs font-medium mb-1 opacity-70">{tt('createRepo.path')}</label>
              <div class="flex gap-2">
                <input
                  class="flex-1 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                  placeholder={tt('createRepo.pathPlaceholder')}
                  value={parentPath()}
                  onInput={(e) => setParentPath(e.currentTarget.value)}
                  disabled={loading()}
                />
                <button
                  class="px-3 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                  onClick={handleSelectPath}
                  disabled={loading()}
                >
                  {tt('common.browse')}
                </button>
              </div>
              <Show when={name().trim() && parentPath().trim()}>
                <p class="mt-1 text-xs opacity-50">
                  {tt('createRepo.fullPathLabel')} {parentPath().replace(/\\/g, '/')}/{name().trim()}
                </p>
              </Show>
            </div>

            {/* Init with README */}
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                class="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-cyan-400"
                checked={initReadme()}
                onChange={(e) => setInitReadme(e.currentTarget.checked)}
                disabled={loading()}
              />
              <span class="text-xs opacity-80">{tt('createRepo.initReadme')}</span>
            </label>

            {/* GitHub push (only if authenticated) */}
            <Show when={githubStore.authenticated}>
              <div class="border-t border-white/10 pt-3 space-y-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-cyan-400"
                    checked={pushToRemote()}
                    onChange={(e) => setPushToRemote(e.currentTarget.checked)}
                    disabled={loading()}
                  />
                  <span class="text-xs opacity-80">{tt('createRepo.pushToGitHub')}</span>
                </label>
                <Show when={pushToRemote()}>
                  <label class="flex items-center gap-2 cursor-pointer ml-6">
                    <input
                      type="checkbox"
                      class="rounded bg-white/10 border-white/20 text-cyan-500 focus:ring-cyan-400"
                      checked={privateRepo()}
                      onChange={(e) => setPrivateRepo(e.currentTarget.checked)}
                      disabled={loading()}
                    />
                    <span class="text-xs opacity-80">{tt('createRepo.private')}</span>
                  </label>
                </Show>
              </div>
            </Show>

            {/* Error */}
            <Show when={error()}>
              <div class="p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs">
                {error()}
              </div>
            </Show>

            {/* Progress */}
            <Show when={loading()}>
              <div class="p-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs">
                {step() === 'init' && tt('createRepo.stepLocal')}
                {step() === 'creating_github' && tt('createRepo.stepGitHub')}
                {step() === 'pushing' && tt('createRepo.stepPush')}
              </div>
            </Show>

            {/* Create button */}
            <button
              class="w-full py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-sm font-medium transition-colors"
              onClick={handleCreate}
              disabled={loading() || !isValid()}
            >
              {loading() ? tt('createRepo.creating') : tt('createRepo.title')}
            </button>
          </div>
        </div>
      </div>
  );
};

export default CreateRepoDialog;
