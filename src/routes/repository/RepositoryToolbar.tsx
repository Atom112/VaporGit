import { A } from '@solidjs/router';

interface RepositoryToolbarProps {
  remoteActionLoading: boolean;
  undoLoading: boolean;
  githubAuthenticated: boolean;
  giteeAuthenticated: boolean;
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
}

const ToolbarButton = (props: {
  children: any;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel: string;
  title: string;
}) => (
  <button
    class="flex-1 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
    onClick={props.onClick}
    disabled={props.disabled}
    aria-label={props.ariaLabel}
    title={props.title}
  >
    {props.children}
  </button>
);

const SyncDownIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PullIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
);

const PushIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2" />
  </svg>
);

const LinkIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const UndoIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a7 7 0 017 7v2M3 10l4-4m-4 4l4 4" />
  </svg>
);

const RedoIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 10H11a7 7 0 00-7 7v2m17-9l-4-4m4 4l-4 4" />
  </svg>
);

const BoxIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

const BranchIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const RebaseIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CompareIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const ToolIcon = () => (
  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

const PullRequestLink = (props: { href: string; title: string }) => (
  <A
    class="flex-1 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
    href={props.href}
    aria-label="PRs"
    title={props.title}
  >
    <BranchIcon />
    PRs
  </A>
);

const RepositoryToolbar = (props: RepositoryToolbarProps) => (
  <div id="toolbar" class="px-3 py-2 border-b border-white/10 shrink-0 space-y-1.5">
    <div class="flex gap-1.5">
      <ToolbarButton onClick={props.onFetch} disabled={props.remoteActionLoading} ariaLabel="Fetch" title="Fetch：从远程下载最新引用、分支和标签，不改动当前工作区。">
        <SyncDownIcon />
        {props.remoteActionLoading ? 'Fetching...' : 'Fetch'}
      </ToolbarButton>
      <ToolbarButton onClick={props.onPull} disabled={props.remoteActionLoading} ariaLabel="Pull" title="Pull：拉取远程更新并合并到当前分支，可能会改动工作区。">
        <PullIcon />
        {props.remoteActionLoading ? 'Pulling...' : 'Pull'}
      </ToolbarButton>
      <ToolbarButton onClick={props.onPush} disabled={props.remoteActionLoading} ariaLabel="Push" title="Push：将本地提交推送到远程分支。">
        <PushIcon />
        {props.remoteActionLoading ? 'Pushing...' : 'Push'}
      </ToolbarButton>
      <ToolbarButton onClick={props.onRemoteManager} ariaLabel="Remote Manager" title="Remotes：查看、新增、编辑或删除远程仓库地址。">
        <LinkIcon />
        Remotes
      </ToolbarButton>
    </div>

    <div class="flex gap-1.5">
      <ToolbarButton onClick={props.onUndo} disabled={props.undoLoading} ariaLabel="Undo" title="Undo：软撤销最近一次提交，并保留已暂存的变更。">
        <UndoIcon />
        {props.undoLoading ? '...' : 'Undo'}
      </ToolbarButton>
      <ToolbarButton onClick={props.onRedo} disabled={props.undoLoading} ariaLabel="Redo" title="Redo：尝试恢复刚刚被撤销的提交。">
        <RedoIcon />
        {props.undoLoading ? '...' : 'Redo'}
      </ToolbarButton>
      <ToolbarButton onClick={props.onStash} ariaLabel="Stash" title="Stash：临时保存、恢复或删除工作区变更。">
        <BoxIcon />
        Stash
      </ToolbarButton>
      <ToolbarButton onClick={props.onMerge} ariaLabel="Merge" title="Merge：将其它分支合并到当前分支。">
        <BranchIcon />
        Merge
      </ToolbarButton>
    </div>

    <div class="flex gap-1.5">
      <ToolbarButton onClick={props.onRebase} ariaLabel="Rebase" title="Rebase：把当前分支的提交重放到另一个分支或提交之上。">
        <RebaseIcon />
        Rebase
      </ToolbarButton>
      <ToolbarButton onClick={props.onBranchCompare} ariaLabel="Branch Compare" title="Compare：比较两个分支之间的提交和文件变更。">
        <CompareIcon />
        Compare
      </ToolbarButton>
      <ToolbarButton onClick={props.onGitTools} ariaLabel="Tools" title="Tools：打开标签、子模块、Blame、Reflog、LFS、SSH 检查等 Git 工具。">
        <ToolIcon />
        Tools
      </ToolbarButton>
      {props.githubAuthenticated && <PullRequestLink href="/pulls" title="PRs：查看、创建和合并当前 GitHub 仓库的 Pull Request。" />}
      {props.giteeAuthenticated && <PullRequestLink href="/gitee-pulls" title="PRs：查看、创建和合并当前 Gitee 仓库的 Pull Request。" />}
    </div>
  </div>
);

export default RepositoryToolbar;
