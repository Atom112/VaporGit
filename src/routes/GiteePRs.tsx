import { Component, createSignal, createResource, Show } from 'solid-js';
import { repoStore } from '../stores/repoStore';
import { giteeStore } from '../stores/giteeStore';
import { getRemotes } from '../lib/tauriCommands';
import { tt } from '../i18n';
import type { GiteePullRequest } from '../lib/types';
import GiteePRList from '../components/gitee/GiteePRList';
import GiteePRDetail from '../components/gitee/GiteePRDetail';
import GiteePRCreateDialog from '../components/gitee/GiteePRCreateDialog';

function parseGiteeRemote(url: string): { owner: string; repo: string } | null {
  let match = url.match(/gitee\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
  return null;
}

const GiteePRs: Component = () => {
  const [selectedPR, setSelectedPR] = createSignal<GiteePullRequest | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  const [remoteInfo] = createResource(
    () => repoStore.repoPath,
    async (path) => {
      if (!path) return null;
      const remotes = await getRemotes(path);
      const origin = remotes.find((r) => r.name === 'origin');
      return origin ? parseGiteeRemote(origin.url) : null;
    }
  );

  const owner = () => remoteInfo()?.owner;
  const repo = () => remoteInfo()?.repo;

  return (
    <div class="h-full flex flex-col">
      <Show when={!giteeStore.authenticated}>
        <div class="flex-1 flex items-center justify-center">
          <p class="text-sm text-gray-500">{tt('pr.loginRequired')}</p>
        </div>
      </Show>

      <Show when={giteeStore.authenticated && remoteInfo.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-sm text-gray-500">{tt('pr.detectingRemote')}</div>
        </div>
      </Show>

      <Show when={giteeStore.authenticated && !remoteInfo.loading && !owner()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-gray-500">{tt('pr.noRemote')}</p>
            <p class="text-xs text-gray-600 mt-1">{tt('pr.noRemoteHint')}</p>
          </div>
        </div>
      </Show>

      <Show when={giteeStore.authenticated && owner() && repo()}>
        <Show when={showCreate()}>
          <GiteePRCreateDialog
            owner={owner()!}
            repo={repo()!}
            defaultBase="main"
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              setSelectedPR(null);
            }}
          />
        </Show>

        <Show when={!selectedPR()}>
          <div class="flex-1 overflow-auto p-4">
            <h2 class="text-base font-bold mb-3">
              {owner()}/{repo()}
            </h2>
            <GiteePRList
              owner={owner()!}
              repo={repo()!}
              onSelect={(pr) => setSelectedPR(pr)}
              onCreateNew={() => setShowCreate(true)}
            />
          </div>
        </Show>

        <Show when={selectedPR()}>
          <div class="flex-1 overflow-hidden">
            <GiteePRDetail
              owner={owner()!}
              repo={repo()!}
              pr={selectedPR()!}
              onBack={() => setSelectedPR(null)}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default GiteePRs;
