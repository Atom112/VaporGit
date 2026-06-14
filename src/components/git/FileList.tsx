import { Component, createSignal, For, JSX, Show } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import type { FileStatus } from '../../lib/types';
import { tt, ttf } from '../../i18n';

interface FileListProps {
  stagedFiles: FileStatus[];
  unstagedFiles: FileStatus[];
  selectedFile?: string;
  onToggleStage: (file: FileStatus) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onSelectFile: (path: string) => void;
  onDiscard?: (file: FileStatus) => void;
  onDiscardAll?: () => void;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[];
  file?: FileStatus;
}

interface VirtualFileListProps {
  files: FileStatus[];
  renderFileRow: (file: FileStatus, indent: number) => JSX.Element;
}

const VirtualFileList: Component<VirtualFileListProps> = (props) => {
  let parentRef: HTMLDivElement | undefined;
  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return props.files.length;
    },
    getScrollElement: () => parentRef ?? null,
    estimateSize: () => 36,
    overscan: 8,
  });

  return (
    <div ref={(el) => { parentRef = el; }} class="max-h-[42vh] overflow-auto">
      <div
        class="relative"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        <For each={rowVirtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const file = props.files[virtualRow.index];
            return (
              <div
                ref={(el) => rowVirtualizer.measureElement(el)}
                data-index={virtualRow.index}
                class="absolute left-0 right-0"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {file ? props.renderFileRow(file, 0) : null}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

const statusLabel = (status: FileStatus['status']): string => {
  switch (status) {
    case 'WT_NEW':
      return 'U';
    case 'WT_MODIFIED':
      return 'M';
    case 'WT_DELETED':
      return 'D';
    case 'INDEX_NEW':
      return 'A';
    case 'INDEX_MODIFIED':
      return 'M';
    case 'INDEX_DELETED':
      return 'D';
    case 'CONFLICTED':
      return '!';
    case 'RENAMED':
      return 'R';
    default:
      return '?';
  }
};

const statusColor = (status: FileStatus['status']): string => {
  switch (status) {
    case 'WT_NEW':
    case 'INDEX_NEW':
      return 'text-green-400';
    case 'WT_MODIFIED':
    case 'INDEX_MODIFIED':
      return 'text-yellow-400';
    case 'WT_DELETED':
    case 'INDEX_DELETED':
      return 'text-red-400';
    case 'CONFLICTED':
      return 'text-orange-400';
    case 'RENAMED':
      return 'text-purple-400';
    default:
      return 'text-white/60';
  }
};

function buildFileTree(files: FileStatus[]): FileNode[] {
  const root: FileNode[] = [];
  const dirMap: Record<string, FileNode> = {};

  for (const file of files) {
    const parts = file.path.replace(/\\/g, '/').split('/');
    if (parts.length === 1) {
      root.push({ name: file.path, path: file.path, isDir: false, children: [], file });
    } else {
      // Ensure directory hierarchy exists
      let parent = root;
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        if (!dirMap[currentPath]) {
          const dirNode: FileNode = { name: parts[i], path: currentPath, isDir: true, children: [] };
          dirMap[currentPath] = dirNode;
          parent.push(dirNode);
        }
        parent = dirMap[currentPath].children;
      }
      parent.push({ name: parts[parts.length - 1], path: file.path, isDir: false, children: [], file });
    }
  }

  // Sort: directories first, then files, both alphabetically
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isDir) sortNodes(node.children);
    }
  };
  sortNodes(root);

  return root;
}

const FileList: Component<FileListProps> = (props) => {
  const [discardTarget, setDiscardTarget] = createSignal<{ type: 'file'; file: FileStatus } | { type: 'all' } | null>(null);
  const [discardPhase, setDiscardPhase] = createSignal<'enter' | 'exit' | null>(null);
  const [treeMode, setTreeMode] = createSignal(false);
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set());

  const openDiscardConfirm = (target: { type: 'file'; file: FileStatus } | { type: 'all' }) => {
    setDiscardTarget(target);
    setDiscardPhase('enter');
  };

  const closeDiscardConfirm = () => {
    if (discardPhase() === 'exit') return;
    setDiscardPhase('exit');
    setTimeout(() => {
      setDiscardPhase(null);
      setDiscardTarget(null);
    }, 120);
  };

  const handleDiscardConfirm = () => {
    const target = discardTarget();
    if (!target) return;
    if (target.type === 'file') {
      props.onDiscard?.(target.file);
    } else {
      props.onDiscardAll?.();
    }
    closeDiscardConfirm();
  };

  const toggleDir = (path: string) => {
    const next = new Set(expandedDirs());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedDirs(next);
  };

  const renderFileRow = (file: FileStatus, indent: number) => (
    <div
      role="button"
      tabIndex={0}
      class={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/10 transition-colors text-sm ${
        props.selectedFile === file.path ? 'bg-white/10' : ''
      }`}
      style={{ 'padding-left': `${8 + indent * 16}px` }}
      onClick={() => props.onSelectFile(file.path)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelectFile(file.path);
        }
      }}
      aria-label={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
    >
      <span
        class={`w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold bg-white/10 ${statusColor(
          file.status
        )}`}
      >
        {statusLabel(file.status)}
      </span>
      <span class="truncate flex-1" title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}>
        <Show when={file.oldPath}>
          <span class="opacity-50 line-through mr-1">{file.oldPath}</span>
          <span class="opacity-40 mx-0.5">→</span>
        </Show>
        {file.path}
      </span>
      <div class="flex gap-1 shrink-0">
        <Show when={props.onDiscard && !file.staged}>
          <button
            class="text-[11px] px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors"
            aria-label={ttf('repo.discardConfirm', file.path)}
            onClick={(e) => {
              e.stopPropagation();
              openDiscardConfirm({ type: 'file', file });
            }}
          >
            {tt('repo.discard')}
          </button>
        </Show>
        <button
          class={`text-[11px] px-2 py-0.5 rounded transition-colors shrink-0 ${
            file.staged
              ? 'bg-white/10 hover:bg-white/20 text-white/70'
              : 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300'
          }`}
          aria-label={`${file.staged ? tt('repo.unstage') : tt('repo.stage')}: ${file.path}`}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggleStage(file);
          }}
        >
          {file.staged ? tt('repo.unstage') : tt('repo.stage')}
        </button>
      </div>
    </div>
  );

  const renderTreeNode = (node: FileNode, indent: number) => {
    if (!node.isDir) {
      return node.file ? renderFileRow(node.file, indent) : null;
    }

    const expanded = expandedDirs().has(node.path);
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          class="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-white/10 transition-colors text-sm text-white/60"
          style={{ 'padding-left': `${8 + indent * 16}px` }}
          onClick={() => toggleDir(node.path)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDir(node.path);
            }
          }}
          aria-expanded={expanded}
          aria-label={node.path}
        >
          <svg
            class={`w-3 h-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg class="w-3.5 h-3.5 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="truncate">{node.name}</span>
        </div>
        <Show when={expanded}>
          <For each={node.children}>{(child) => renderTreeNode(child, indent + 1)}</For>
        </Show>
      </>
    );
  };

  const renderFileList = (files: FileStatus[]) => {
    if (!treeMode()) {
      return <VirtualFileList files={files} renderFileRow={renderFileRow} />;
    }
    const tree = buildFileTree(files);
    return <For each={tree}>{(node) => renderTreeNode(node, 0)}</For>;
  };

  return (
    <div class="flex flex-col h-full">
      {/* Unstaged files (top) */}
      <Show when={props.unstagedFiles.length > 0}>
        <div class={props.stagedFiles.length > 0 ? 'border-b border-white/10' : ''}>
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              {ttf('repo.changedCount', props.unstagedFiles.length)}
            </span>
            <div class="flex gap-2 items-center">
              <Show when={props.onDiscardAll}>
                <button
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                  onClick={() => openDiscardConfirm({ type: 'all' })}
                  aria-label={ttf('repo.discardAllConfirm', props.unstagedFiles.length)}
                >
                  {tt('repo.discardAll')}
                </button>
              </Show>
              <button
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={props.onStageAll}
                aria-label={tt('repo.stageAll')}
              >
                {tt('repo.stageAll')}
              </button>
              <button
                class={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  treeMode() ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-white/50 hover:text-white/70'
                }`}
                onClick={() => setTreeMode(!treeMode())}
                title={treeMode() ? 'Flat view' : 'Tree view'}
                aria-label={treeMode() ? 'Flat view' : 'Tree view'}
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" />
                </svg>
              </button>
            </div>
          </div>
          {renderFileList(props.unstagedFiles)}
        </div>
      </Show>

      {/* Staged files (bottom) */}
      <Show when={props.stagedFiles.length > 0}>
        <div class="flex-1">
          <div class="flex items-center justify-between px-3 py-2">
            <span class="text-xs font-semibold opacity-60 uppercase">
              {ttf('repo.stagedCount', props.stagedFiles.length)}
            </span>
            <div class="flex gap-2 items-center">
              <button
                class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                onClick={props.onUnstageAll}
                aria-label={tt('repo.unstageAll')}
              >
                {tt('repo.unstageAll')}
              </button>
              <button
                class={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  treeMode() ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-white/50 hover:text-white/70'
                }`}
                onClick={() => setTreeMode(!treeMode())}
                title={treeMode() ? 'Flat view' : 'Tree view'}
                aria-label={treeMode() ? 'Flat view' : 'Tree view'}
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" />
                </svg>
              </button>
            </div>
          </div>
          {renderFileList(props.stagedFiles)}
        </div>
      </Show>

      <Show when={props.stagedFiles.length === 0 && props.unstagedFiles.length === 0}>
        <div class="flex-1 flex items-center justify-center p-4 text-sm opacity-40">
          {tt('repo.clean')}
        </div>
      </Show>

      {/* Discard confirmation dialog */}
      <Show when={discardPhase() && discardTarget()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div class={`w-80 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
            discardPhase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
          }`}>
            <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 class="text-sm font-bold text-red-400">{tt('repo.discard')}</h2>
              <button
                class="text-xs opacity-50 hover:text-red-400 transition-colors"
                onClick={closeDiscardConfirm}
              >
                {tt('common.close')}
              </button>
            </div>
            <div class="p-4 space-y-4">
              <Show when={discardTarget()?.type === 'file'} fallback={
                <p class="text-sm">{ttf('repo.discardAllConfirm', props.unstagedFiles.length)}</p>
              }>
                <p class="text-sm">
                  {ttf('repo.discardConfirm', (discardTarget() as any)?.file?.path ?? '')}
                </p>
              </Show>
              <div class="flex gap-2 justify-end">
                <button
                  class="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
                  onClick={closeDiscardConfirm}
                >
                  {tt('common.cancel')}
                </button>
                <button
                  class="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium transition-colors"
                  onClick={handleDiscardConfirm}
                >
                  {tt('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default FileList;
