import FileList from '../../components/git/FileList';
import type { FileStatus } from '../../lib/types';
import { tt } from '../../i18n';
import CommitInput from './CommitInput';
import RepositoryToolbar from './RepositoryToolbar';

interface RightPanelProps {
  width: number;
  remoteActionLoading: boolean;
  undoLoading: boolean;
  githubAuthenticated: boolean;
  giteeAuthenticated: boolean;
  commitMessage: string;
  amendMode: boolean;
  stagedFiles: FileStatus[];
  unstagedFiles: FileStatus[];
  selectedFile?: string;
  commitError: string | null;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onRemoteManager: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onStash: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onBranchCompare: () => void;
  onGitTools: () => void;
  onCommitMessageChange: (message: string) => void;
  onAmendModeChange: (enabled: boolean) => void;
  onCommit: () => void;
  onToggleStage: (file: FileStatus) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onSelectFile: (filePath: string) => void;
  onDiscard: (file: FileStatus) => void;
  onDiscardAll: () => void;
  onOpenTerminal: () => void;
}

const TerminalIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const RightPanel = (props: RightPanelProps) => (
  <div
    class="flex flex-col bg-white/5 overflow-hidden shrink-0"
    style={{ width: `${props.width}px` }}
  >
    <RepositoryToolbar
      remoteActionLoading={props.remoteActionLoading}
      undoLoading={props.undoLoading}
      githubAuthenticated={props.githubAuthenticated}
      giteeAuthenticated={props.giteeAuthenticated}
      onFetch={props.onFetch}
      onPull={props.onPull}
      onPush={props.onPush}
      onRemoteManager={props.onRemoteManager}
      onUndo={props.onUndo}
      onRedo={props.onRedo}
      onStash={props.onStash}
      onMerge={props.onMerge}
      onRebase={props.onRebase}
      onBranchCompare={props.onBranchCompare}
      onGitTools={props.onGitTools}
    />

    <CommitInput
      message={props.commitMessage}
      amendMode={props.amendMode}
      stagedCount={props.stagedFiles.length}
      error={props.commitError}
      onMessageChange={props.onCommitMessageChange}
      onAmendModeChange={props.onAmendModeChange}
      onCommit={props.onCommit}
    />

    <div id="file-list-area" class="flex-1 overflow-auto">
      <FileList
        stagedFiles={props.stagedFiles}
        unstagedFiles={props.unstagedFiles}
        selectedFile={props.selectedFile}
        onToggleStage={props.onToggleStage}
        onStageAll={props.onStageAll}
        onUnstageAll={props.onUnstageAll}
        onSelectFile={props.onSelectFile}
        onDiscard={props.onDiscard}
        onDiscardAll={props.onDiscardAll}
      />
    </div>

    <div class="p-2 border-t border-white/10 shrink-0">
      <button
        class="w-full py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5"
        onClick={props.onOpenTerminal}
        aria-label={tt('repo.terminal')}
      >
        <TerminalIcon />
        {tt('repo.terminal')}
      </button>
    </div>
  </div>
);

export default RightPanel;
