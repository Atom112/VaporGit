import { Component, createSignal, createResource, Show } from 'solid-js';
import { repoStore } from '../stores/repoStore';
import { githubStore } from '../stores/githubStore';
import { getRemotes } from '../lib/tauriCommands';
import { tt } from '../i18n';
import type { GitHubPullRequest } from '../lib/types';
import PRList from '../components/github/PRList';
import PRDetail from '../components/github/PRDetail';
import PRCreateDialog from '../components/github/PRCreateDialog';

/** Parse GitHub owner/repo from a remote URL. */
function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  // SSH: git@github.com:owner/repo.git
  let match = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  }
  return null;
}

const GitHubPRs: Component = () => {
  const [selectedPR, setSelectedPR] = createSignal<GitHubPullRequest | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  // Detect repo owner/name from remote URL
  const [remoteInfo] = createResource(
    () => repoStore.repoPath,
    async (path) => {
      if (!path) return null;
      const remotes = await getRemotes(path);
      const origin = remotes.find((r) => r.name === 'origin');
      return origin ? parseGitHubRemote(origin.url) : null;
    }
  );

  const owner = () => remoteInfo()?.owner;
  const repo = () => remoteInfo()?.repo;

  return (
    <div class="h-full flex flex-col">
      <Show when={!githubStore.authenticated}>
        <div class="flex-1 flex items-center justify-center">
          <p class="text-sm text-gray-500">{tt('pr.loginRequired')}</p>
        </div>
      </Show>

      <Show when={githubStore.authenticated && remoteInfo.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-sm text-gray-500">{tt('pr.detectingRemote')}</div>
        </div>
      </Show>

      <Show when={githubStore.authenticated && !remoteInfo.loading && !owner()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-gray-500">{tt('pr.noRemote')}</p>
            <p class="text-xs text-gray-600 mt-1">{tt('pr.noRemoteHint')}</p>
          </div>
        </div>
      </Show>

      <Show when={githubStore.authenticated && owner() && repo()}>
        <Show when={showCreate()}>
          <PRCreateDialog
            owner={owner()!}
            repo={repo()!}
            defaultBase="main"
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              setSelectedPR(null); // Refresh list by going back
            }}
          />
        </Show>

        <Show when={!selectedPR()}>
          <div class="flex-1 overflow-auto p-4">
            <h2 class="text-base font-bold mb-3">
              {owner()}/{repo()}
            </h2>
            <PRList
              owner={owner()!}
              repo={repo()!}
              onSelect={(pr) => setSelectedPR(pr)}
              onCreateNew={() => setShowCreate(true)}
            />
          </div>
        </Show>

        <Show when={selectedPR()}>
          <div class="flex-1 overflow-hidden">
            <PRDetail
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

export default GitHubPRs;
