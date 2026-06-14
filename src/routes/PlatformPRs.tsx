import { Component, Show, createResource, createSignal } from 'solid-js';
import { repoStore } from '../stores/repoStore';
import { getRemotes } from '../lib/tauriCommands';
import { parsePlatformRemote, PlatformKind, PlatformPullRequest } from '../lib/platformAdapter';
import { tt } from '../i18n';
import PlatformPRCreateDialog from '../components/platform/PlatformPRCreateDialog';
import PlatformPRDetail from '../components/platform/PlatformPRDetail';
import PlatformPRList from '../components/platform/PlatformPRList';

interface PlatformPRsProps {
  kind: PlatformKind;
  authenticated: boolean;
}

const PlatformPRs: Component<PlatformPRsProps> = (props) => {
  const [selectedPR, setSelectedPR] = createSignal<PlatformPullRequest | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  const [remoteInfo] = createResource(
    () => [props.kind, repoStore.repoPath] as const,
    async ([kind, path]) => {
      if (!path) return null;
      const remotes = await getRemotes(path);
      const origin = remotes.find((remote) => remote.name === 'origin');
      const parsed = origin ? parsePlatformRemote(origin.url) : null;
      return parsed?.kind === kind ? { owner: parsed.owner, repo: parsed.repo } : null;
    },
  );

  const owner = () => remoteInfo()?.owner;
  const repo = () => remoteInfo()?.repo;

  return (
    <div class="h-full flex flex-col">
      <Show when={!props.authenticated}>
        <div class="flex-1 flex items-center justify-center">
          <p class="text-sm text-gray-500">{tt('pr.loginRequired')}</p>
        </div>
      </Show>

      <Show when={props.authenticated && remoteInfo.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-sm text-gray-500">{tt('pr.detectingRemote')}</div>
        </div>
      </Show>

      <Show when={props.authenticated && !remoteInfo.loading && !owner()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-gray-500">{tt('pr.noRemote')}</p>
            <p class="text-xs text-gray-600 mt-1">{tt('pr.noRemoteHint')}</p>
          </div>
        </div>
      </Show>

      <Show when={props.authenticated && owner() && repo()}>
        <Show when={showCreate()}>
          <PlatformPRCreateDialog
            kind={props.kind}
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
            <PlatformPRList
              kind={props.kind}
              owner={owner()!}
              repo={repo()!}
              onSelect={(pr) => setSelectedPR(pr)}
              onCreateNew={() => setShowCreate(true)}
            />
          </div>
        </Show>

        <Show when={selectedPR()}>
          <div class="flex-1 overflow-hidden">
            <PlatformPRDetail
              kind={props.kind}
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

export default PlatformPRs;
