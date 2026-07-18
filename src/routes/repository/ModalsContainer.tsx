import { Show } from 'solid-js';
import BranchCompareDialog from '../../components/git/BranchCompareDialog';
import ConflictResolver from '../../components/git/ConflictResolver';
import GitToolsPanel from '../../components/git/GitToolsPanel';
import InteractiveRebase from '../../components/git/InteractiveRebase';
import MergeDialog from '../../components/git/MergeDialog';
import PushDialog from '../../components/git/PushDialog';
import RemoteManager from '../../components/git/RemoteManager';
import StashPanel from '../../components/git/StashPanel';
import PlatformPRCreateDialog from '../../components/platform/PlatformPRCreateDialog';
import { giteeStore } from '../../stores/giteeStore';
import { githubStore } from '../../stores/githubStore';
import { tt } from '../../i18n';
import type { PlatformKind } from '../../lib/platformAdapter';

interface ModalsContainerProps {
  repoPath: string | null;
  selectedFile?: string;
  showStashPanel: boolean;
  showRemoteManager: boolean;
  showConflictResolver: boolean;
  showRebaseDialog: boolean;
  showMergeDialog: boolean;
  showBranchCompare: boolean;
  showPushDialog: boolean;
  showGitTools: boolean;
  showPRCreate: boolean;
  prCreateInfo: { owner: string; repo: string } | null;
  prCreatePlatform: PlatformKind;
  createBranchDialog: { commitId: string } | null;
  createBranchName: string;
  createBranchLoading: boolean;
  onCloseStashPanel: () => void;
  onCloseRemoteManager: () => void;
  onCloseConflictResolver: () => void;
  onCloseRebaseDialog: () => void;
  onCloseMergeDialog: () => void;
  onCloseBranchCompare: () => void;
  onClosePushDialog: () => void;
  onCloseGitTools: () => void;
  onClosePRCreate: () => void;
  onPRCreated: () => void;
  onCloseCreateBranch: () => void;
  onCreateBranchNameChange: (name: string) => void;
  onCreateBranchSubmit: () => void;
  onStashRefresh: () => void;
  onRemoteRefresh: () => void;
  onConflictRefresh: () => void;
  onRebaseRefresh: () => void;
  onMergeRefresh: () => void;
  onPushRefresh: () => void;
  onGitToolsRefresh: () => void;
}

const ModalsContainer = (props: ModalsContainerProps) => (
  <>
    <Show when={props.showStashPanel && props.repoPath}>
      <StashPanel
        repoPath={props.repoPath!}
        onClose={props.onCloseStashPanel}
        onRefresh={props.onStashRefresh}
      />
    </Show>

    <Show when={props.showRemoteManager && props.repoPath}>
      <RemoteManager
        repoPath={props.repoPath!}
        onClose={props.onCloseRemoteManager}
        onRefresh={props.onRemoteRefresh}
      />
    </Show>

    <Show when={props.showConflictResolver && props.repoPath}>
      <ConflictResolver
        repoPath={props.repoPath!}
        onClose={props.onCloseConflictResolver}
        onRefresh={props.onConflictRefresh}
      />
    </Show>

    <Show when={props.showRebaseDialog && props.repoPath}>
      <InteractiveRebase
        repoPath={props.repoPath!}
        onClose={props.onCloseRebaseDialog}
        onRefresh={props.onRebaseRefresh}
      />
    </Show>

    <Show when={props.showMergeDialog && props.repoPath}>
      <MergeDialog
        repoPath={props.repoPath!}
        onClose={props.onCloseMergeDialog}
        onRefresh={props.onMergeRefresh}
      />
    </Show>

    <Show when={props.showBranchCompare && props.repoPath}>
      <BranchCompareDialog
        repoPath={props.repoPath!}
        onClose={props.onCloseBranchCompare}
      />
    </Show>

    <Show when={props.showPushDialog && props.repoPath}>
      <PushDialog
        repoPath={props.repoPath!}
        onClose={props.onClosePushDialog}
        onRefresh={props.onPushRefresh}
      />
    </Show>

    <Show when={props.showGitTools && props.repoPath}>
      <GitToolsPanel
        repoPath={props.repoPath!}
        selectedFile={props.selectedFile}
        onClose={props.onCloseGitTools}
        onRefresh={props.onGitToolsRefresh}
      />
    </Show>

    <Show
      when={
        props.showPRCreate &&
        props.prCreateInfo &&
        ((props.prCreatePlatform === 'github' && githubStore.authenticated) ||
          (props.prCreatePlatform === 'gitee' && giteeStore.authenticated))
      }
    >
      <PlatformPRCreateDialog
        kind={props.prCreatePlatform}
        owner={props.prCreateInfo!.owner}
        repo={props.prCreateInfo!.repo}
        defaultBase="main"
        onClose={props.onClosePRCreate}
        onCreated={props.onPRCreated}
      />
    </Show>

    <Show when={props.createBranchDialog}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl animate-modal-enter">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h2 class="text-sm font-bold">{tt('commit.createBranchFrom')}</h2>
            <button
              class="text-xs opacity-50 hover:text-red-400 transition-colors"
              onClick={props.onCloseCreateBranch}
            >
              {tt('common.close')}
            </button>
          </div>
          <div class="p-4 space-y-3">
            <div>
              <label class="block text-xs font-medium mb-1 opacity-70">{tt('repo.branchName')}</label>
              <input
                class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
                placeholder={tt('repo.branchNamePlaceholder')}
                value={props.createBranchName}
                onInput={(e) => props.onCreateBranchNameChange(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && props.onCreateBranchSubmit()}
                disabled={props.createBranchLoading}
                autofocus
              />
            </div>
            <div class="flex gap-2">
              <button
                class="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors"
                onClick={props.onCloseCreateBranch}
                disabled={props.createBranchLoading}
              >
                {tt('common.cancel')}
              </button>
              <button
                class="flex-1 py-2 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-xs font-medium transition-colors"
                onClick={props.onCreateBranchSubmit}
                disabled={!props.createBranchName.trim() || props.createBranchLoading}
              >
                {props.createBranchLoading ? tt('repo.creatingBranch') : tt('common.create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  </>
);

export default ModalsContainer;
