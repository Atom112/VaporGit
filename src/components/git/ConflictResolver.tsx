import { Component, createSignal, Show, For, createMemo, onMount } from 'solid-js';
import { getConflicts, resolveConflict, getConflictContent, resolveConflictBlocks } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { ConflictEntry, BlockResolution } from '../../lib/types';
import { detectLanguage, highlightLines } from '../../lib/syntax';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

interface ConflictBlock {
  index: number;
  ours: string;
  theirs: string;
  fullMatch: string;
}

function parseConflictMarkers(content: string): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];
  const regex = /<<<<<<< .*?\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> .*?(?:\n|$)/g;
  let match;
  let index = 0;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      index: index++,
      ours: match[1],
      theirs: match[2],
      fullMatch: match[0],
    });
  }
  return blocks;
}

const ConflictResolver: Component<Props> = (props) => {
  const [conflicts, setConflicts] = createSignal<ConflictEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [worktreeContent, setWorktreeContent] = createSignal<string>('');
  const [contentLoading, setContentLoading] = createSignal(false);
  const [resolving, setResolving] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Per-block resolution state
  // null = not yet resolved, otherwise the chosen BlockResolution
  const [blockResolutions, setBlockResolutions] = createSignal<Record<number, BlockResolution>>({});
  // Which block is being manually edited (expanded edit box)
  const [editingBlock, setEditingBlock] = createSignal<number | null>(null);
  // Current manual edit content per block
  const [manualContent, setManualContent] = createSignal<Record<number, string>>({});
  // Current block index for navigation
  const [currentBlockIndex, setCurrentBlockIndex] = createSignal<number>(0);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const list = await getConflicts(props.repoPath);
      setConflicts(list);
      if (list.length === 0) props.onClose();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    setSelectedFile(filePath);
    setContentLoading(true);
    setWorktreeContent('');
    setBlockResolutions({});
    setEditingBlock(null);
    setManualContent({});
    setCurrentBlockIndex(0);
    try {
      const worktree = await getConflictContent(props.repoPath, filePath, 'worktree');
      setWorktreeContent(worktree);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setContentLoading(false);
    }
  };

  /// Resolve a single block with a given action
  const resolveBlock = (blockIndex: number, action: 'ours' | 'theirs' | 'manual', customContent = '') => {
    setBlockResolutions(prev => ({
      ...prev,
      [blockIndex]: { blockIndex, action, customContent },
    }));
    setEditingBlock(null);
  };

  /// Remove a per-block resolution (un-resolve)
  const unresolveBlock = (blockIndex: number) => {
    setBlockResolutions(prev => {
      const next = { ...prev };
      delete next[blockIndex];
      return next;
    });
  };

  /// Start editing a block manually
  const startManualEdit = (blockIndex: number, initialContent: string) => {
    setEditingBlock(blockIndex);
    setManualContent(prev => {
      // Only set if not already set
      if (!(blockIndex in prev)) {
        return { ...prev, [blockIndex]: initialContent };
      }
      return prev;
    });
  };

  /// Update manual content for a block
  const updateManualContent = (blockIndex: number, content: string) => {
    setManualContent(prev => ({ ...prev, [blockIndex]: content }));
  };

  /// Save all block resolutions to the backend
  const handleSaveFile = async () => {
    const file = selectedFile();
    if (!file) return;

    const res = blockResolutions();
    const resolutions = Object.values(res);

    if (resolutions.length === 0) {
      addToast(tt('repo.conflictResolveBlockFirst'), 'info');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await resolveConflictBlocks(props.repoPath, file, resolutions);
      addToast(ttf('repo.conflictResolved', file), 'success');
      await loadConflicts();
      props.onRefresh();
      if (selectedFile() === file) {
        setSelectedFile(null);
        setWorktreeContent('');
        setBlockResolutions({});
        setEditingBlock(null);
        setManualContent({});
        setCurrentBlockIndex(0);
      }
    } catch (e) {
      addToast(ttf('repo.conflictResolveFailed', describeError(e)), 'error');
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  /// Resolve all blocks in the current file with the same action
  const handleResolveAllBlocks = async (action: 'ours' | 'theirs') => {
    const blocks = conflictBlocks();
    const resolutions: Record<number, BlockResolution> = {};
    for (const block of blocks) {
      if (action === 'ours') {
        resolutions[block.index] = { blockIndex: block.index, action: 'ours', customContent: '' };
      } else {
        resolutions[block.index] = { blockIndex: block.index, action: 'theirs', customContent: '' };
      }
    }
    setBlockResolutions(resolutions);
    setEditingBlock(null);
  };

  /// Navigate to a specific block
  const goToBlock = (index: number) => {
    const blocks = conflictBlocks();
    if (index < 0) index = 0;
    if (index >= blocks.length) index = blocks.length - 1;
    setCurrentBlockIndex(index);

    // Scroll the block into view
    const el = document.getElementById(`conflict-block-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleResolve = async (file: string, resolution: string) => {
    setResolving(file);
    setError(null);
    try {
      await resolveConflict(props.repoPath, file, resolution);
      addToast(ttf('repo.conflictResolved', file), 'success');
      await loadConflicts();
      props.onRefresh();
      if (selectedFile() === file) {
        setSelectedFile(null);
        setWorktreeContent('');
      }
    } catch (e) {
      addToast(ttf('repo.conflictResolveFailed', describeError(e)), 'error');
      setError(describeError(e));
    } finally {
      setResolving(null);
    }
  };

  const handleResolveAll = async (resolution: string) => {
    const current = conflicts();
    for (const c of current) {
      try {
        await resolveConflict(props.repoPath, c.filePath, resolution);
      } catch (e) {
        addToast(ttf('repo.conflictResolveFailed', describeError(e)), 'error');
        setError(describeError(e));
      }
    }
    await loadConflicts();
    props.onRefresh();
  };

  onMount(() => {
    loadConflicts();
  });

  // Parse conflict blocks from the working tree file content
  const conflictBlocks = createMemo(() => {
    const content = worktreeContent();
    if (!content) return [];
    return parseConflictMarkers(content);
  });

  // Count resolved blocks
  const resolvedCount = createMemo(() => {
    const res = blockResolutions();
    const blocks = conflictBlocks();
    return blocks.filter(b => b.index in res).length;
  });

  // Compute resolution state for display
  const blockState = (blockIndex: number) => {
    const res = blockResolutions();
    if (!(blockIndex in res)) return 'unresolved';
    return res[blockIndex].action;
  };

  // Syntax highlighting language
  const lang = createMemo(() => {
    const file = selectedFile();
    return file ? detectLanguage(file) : null;
  });

  // Pre-compute highlighted lines for ours/theirs content of all blocks
  const blockHighlights = createMemo(() => {
    const blocks = conflictBlocks();
    return blocks.map(b => ({
      ours: highlightLines(b.ours.split('\n'), lang()),
      theirs: highlightLines(b.theirs.split('\n'), lang()),
    }));
  });

  // Split worktree content around conflict blocks for inline display.
  // Tracks block index sequentially as we iterate through regex matches.
  const contentSegments = createMemo(() => {
    const content = worktreeContent();
    if (!content) return [];
    const blocks = conflictBlocks();
    if (blocks.length === 0) return [{ type: 'text' as const, content }];

    const segments: Array<{ type: 'text' | 'block'; content?: string; blockIndex?: number }> = [];
    let lastEnd = 0;
    let blockIdx = 0;

    const regex = /<<<<<<< .*?\n[\s\S]*?=======\n[\s\S]*?>>>>>>> .*?(?:\n|$)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      // Text before this block
      if (match.index > lastEnd) {
        segments.push({ type: 'text', content: content.slice(lastEnd, match.index) });
      }
      segments.push({ type: 'block', blockIndex: blockIdx });
      lastEnd = match.index + match[0].length;
      blockIdx++;
    }

    // Text after last block
    if (lastEnd < content.length) {
      segments.push({ type: 'text', content: content.slice(lastEnd) });
    }

    return segments;
  });

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="w-[90vw] h-[85vh] flex flex-col rounded-xl bg-[#3a3a3e] border border-white/10 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 class="text-sm font-bold text-yellow-300">{tt('repo.conflictTitle')}</h2>
            <Show when={!loading()}>
              <span class="text-xs opacity-50 ml-2">
                {ttf('repo.conflictCount', conflicts().length)}
              </span>
            </Show>
          </div>
          <button
            class="text-xs opacity-50 hover:text-red-400 transition-colors"
            onClick={props.onClose}
          >
            {tt('common.close')}
          </button>
        </div>

        {error() && (
          <div class="mx-4 mt-3 p-2 rounded bg-red-500/20 border border-red-500/30 text-red-200 text-xs shrink-0">
            {error()}
          </div>
        )}

        {/* Main content: file list + inline merge editor */}
        <div class="flex-1 flex min-h-0">
          {/* Left: file list */}
          <div class="w-56 shrink-0 border-r border-white/10 flex flex-col">
            {/* Batch actions */}
            <Show when={conflicts().length > 1}>
              <div class="flex flex-col gap-1 p-2 border-b border-white/10">
                <button
                  class="py-1 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                  onClick={() => handleResolveAll('ours')}
                >
                  {tt('repo.conflictUseAllOurs')}
                </button>
                <button
                  class="py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                  onClick={() => handleResolveAll('theirs')}
                >
                  {tt('repo.conflictUseAllTheirs')}
                </button>
              </div>
            </Show>

            {/* File list */}
            <div class="flex-1 overflow-auto">
              <Show
                when={!loading()}
                fallback={
                  <div class="flex items-center justify-center py-8 text-xs opacity-40">{tt('common.loading')}</div>
                }
              >
                <Show
                  when={conflicts().length > 0}
                  fallback={
                    <div class="flex items-center justify-center py-8 text-xs opacity-40">{tt('repo.conflictNoConflicts')}</div>
                  }
                >
                  <For each={conflicts()}>
                    {(conflict) => (
                      <div
                        class={`flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer border-l-2 transition-colors ${
                          selectedFile() === conflict.filePath
                            ? 'bg-cyan-500/10 border-l-cyan-400 text-cyan-300'
                            : 'border-l-transparent hover:bg-white/5'
                        }`}
                        onClick={() => loadFileContent(conflict.filePath)}
                      >
                        <svg class="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span class="font-mono truncate flex-1">{conflict.filePath}</span>
                        <Show when={selectedFile() !== conflict.filePath}>
                          <div class="flex gap-1 shrink-0">
                            <button
                              class="px-1 py-0.5 rounded text-[10px] bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 disabled:opacity-30 transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleResolve(conflict.filePath, 'ours'); }}
                              disabled={resolving() === conflict.filePath}
                            >
                              {tt('repo.conflictUseOurs')}
                            </button>
                            <button
                              class="px-1 py-0.5 rounded text-[10px] bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 disabled:opacity-30 transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleResolve(conflict.filePath, 'theirs'); }}
                              disabled={resolving() === conflict.filePath}
                            >
                              {tt('repo.conflictUseTheirs')}
                            </button>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </Show>
              </Show>
            </div>
          </div>

          {/* Right: inline merge editor */}
          <div class="flex-1 flex flex-col min-h-0">
            <Show
              when={selectedFile()}
              fallback={
                <div class="flex-1 flex items-center justify-center text-sm opacity-40">
                  {tt('repo.conflictSelectFile')}
                </div>
              }
            >
              {/* File name header with block navigation */}
              <div class="px-4 py-2 border-b border-white/10 bg-white/5 shrink-0 flex items-center gap-3">
                <span class="text-xs font-mono font-medium opacity-80 flex-1">{selectedFile()}</span>
                <Show when={conflictBlocks().length > 0}>
                  <div class="flex items-center gap-1 text-xs">
                    <button
                      class="px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 hover:bg-white/10 transition-all disabled:opacity-20"
                      onClick={() => goToBlock(currentBlockIndex() - 1)}
                      disabled={currentBlockIndex() <= 0}
                      title={tt('repo.conflictPrevBlock')}
                    >
                      ◀
                    </button>
                    <span class="opacity-60 whitespace-nowrap px-1">
                      {ttf('repo.conflictBlockNav', currentBlockIndex() + 1, conflictBlocks().length)}
                    </span>
                    <button
                      class="px-1.5 py-0.5 rounded opacity-50 hover:opacity-100 hover:bg-white/10 transition-all disabled:opacity-20"
                      onClick={() => goToBlock(currentBlockIndex() + 1)}
                      disabled={currentBlockIndex() >= conflictBlocks().length - 1}
                      title={tt('repo.conflictNextBlock')}
                    >
                      ▶
                    </button>
                  </div>
                  <span class="text-[10px] opacity-40">
                    {ttf('repo.conflictResolveCount', resolvedCount(), conflictBlocks().length)}
                  </span>
                </Show>
              </div>

              {/* Content area: inline merge editor */}
              <div class="flex-1 overflow-auto p-4">
                <Show
                  when={!contentLoading()}
                  fallback={
                    <div class="flex items-center justify-center h-full text-sm opacity-40">
                      {tt('repo.conflictLoadingContent')}
                    </div>
                  }
                >
                  <Show
                    when={worktreeContent()}
                    fallback={
                      <div class="flex items-center justify-center h-full text-sm opacity-40">
                        {tt('repo.conflictNoConflicts')}
                      </div>
                    }
                  >
                    {/* Inline content segments: text and conflict blocks */}
                    <div class="space-y-2">
                      <For each={contentSegments()}>
                        {(segment) => (
                          <>
                            {segment.type === 'text' ? (
                              <pre class="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all select-text px-3 py-1.5 rounded-lg bg-[#2a2a2e] border border-white/5 opacity-80">
                                {segment.content}
                              </pre>
                            ) : (
                              <Show when={segment.blockIndex !== undefined && segment.blockIndex >= 0}>
                                <ConflictBlockCard
                                  block={conflictBlocks()[segment.blockIndex!]}
                                  highlights={blockHighlights()[segment.blockIndex!]}
                                  resolution={blockState(segment.blockIndex!)}
                                  isEditing={editingBlock() === segment.blockIndex}
                                  manualContent={manualContent()[segment.blockIndex!] ?? conflictBlocks()[segment.blockIndex!]?.ours ?? ''}
                                  isFocused={currentBlockIndex() === segment.blockIndex}
                                  onUseOurs={() => resolveBlock(segment.blockIndex!, 'ours')}
                                  onUseTheirs={() => resolveBlock(segment.blockIndex!, 'theirs')}
                                  onManualEdit={() => startManualEdit(segment.blockIndex!, conflictBlocks()[segment.blockIndex!]?.ours ?? '')}
                                  onUpdateManual={(v) => updateManualContent(segment.blockIndex!, v)}
                                  onApplyManual={() => {
                                    const content = manualContent()[segment.blockIndex!];
                                    if (content !== undefined) {
                                      resolveBlock(segment.blockIndex!, 'manual', content);
                                    }
                                  }}
                                  onUnresolve={() => unresolveBlock(segment.blockIndex!)}
                                />
                              </Show>
                            )}
                          </>
                        )}
                      </For>
                    </div>

                    {/* Empty state: no conflict blocks found but file has content */}
                    <Show when={conflictBlocks().length === 0 && worktreeContent()}>
                      <div class="flex items-center justify-center h-32 text-sm opacity-40">
                        <div class="text-center">
                          <p class="mb-2">{tt('repo.conflictNoMarkers')}</p>
                          <div class="flex gap-2 justify-center">
                            <button
                              class="px-3 py-1 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                              onClick={() => resolveConflict(props.repoPath, selectedFile()!, 'ours')}
                            >
                              {tt('repo.conflictUseOurs')}
                            </button>
                            <button
                              class="px-3 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                              onClick={() => resolveConflict(props.repoPath, selectedFile()!, 'theirs')}
                            >
                              {tt('repo.conflictUseTheirs')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </Show>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        {/* Footer */}
        <div class="px-4 py-2 border-t border-white/10 shrink-0 flex items-center justify-between">
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={props.onClose}
            >
              {tt('common.close')}
            </button>
          </div>
          <Show when={selectedFile() && !loading() && conflictBlocks().length > 0}>
            <div class="flex gap-2 items-center">
              <div class="flex gap-1">
                <button
                  class="px-2 py-1 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                  onClick={() => handleResolveAllBlocks('ours')}
                >
                  {tt('repo.conflictUseAllOursBlocks')}
                </button>
                <button
                  class="px-2 py-1 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 disabled:opacity-30 transition-colors"
                  onClick={() => handleResolveAllBlocks('theirs')}
                >
                  {tt('repo.conflictUseAllTheirsBlocks')}
                </button>
              </div>
              <button
                class="px-4 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-30 transition-colors font-semibold"
                onClick={handleSaveFile}
                disabled={saving() || resolvedCount() === 0}
              >
                {saving() ? tt('repo.conflictSaving') : `💾 ${ttf('repo.conflictSaveProgress', resolvedCount(), conflictBlocks().length)}`}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

/* ── Conflict Block Card ── */
interface ConflictBlockCardProps {
  block: ConflictBlock;
  highlights: { ours: string[]; theirs: string[] };
  resolution: string;
  isEditing: boolean;
  manualContent: string;
  isFocused: boolean;
  onUseOurs: () => void;
  onUseTheirs: () => void;
  onManualEdit: () => void;
  onUpdateManual: (content: string) => void;
  onApplyManual: () => void;
  onUnresolve: () => void;
}

const ConflictBlockCard: Component<ConflictBlockCardProps> = (props) => {
  const borderColor = () => {
    switch (props.resolution) {
      case 'ours': return 'border-cyan-500/50';
      case 'theirs': return 'border-purple-500/50';
      case 'manual': return 'border-green-500/50';
      default: return 'border-yellow-500/30';
    }
  };

  const statusLabel = () => {
    switch (props.resolution) {
      case 'ours': return tt('repo.conflictBlockResolvedOurs');
      case 'theirs': return tt('repo.conflictBlockResolvedTheirs');
      case 'manual': return tt('repo.conflictBlockResolvedManual');
      default: return tt('repo.conflictBlockUnresolved');
    }
  };

  const statusColor = () => {
    switch (props.resolution) {
      case 'ours': return 'text-cyan-400';
      case 'theirs': return 'text-purple-400';
      case 'manual': return 'text-green-400';
      default: return 'text-yellow-400';
    }
  };


  return (
    <div
      id={`conflict-block-${props.block.index}`}
      class={`rounded-lg border ${borderColor()} bg-[#2a2a2e] transition-all duration-200 ${
        props.isFocused ? 'ring-1 ring-yellow-500/30 shadow-lg shadow-yellow-500/5' : ''
      }`}
    >
      {/* Block header */}
      <div class="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-white/[0.03]">
        <span class="text-[10px] font-semibold opacity-60">
          {`#${props.block.index + 1}`}
        </span>
        <span class={`text-[10px] font-medium ${statusColor()}`}>
          {statusLabel()}
        </span>

        {/* Actions in header */}
        <div class="ml-auto flex gap-1">
          <Show when={props.resolution !== 'unresolved'}>
            <button
              class="px-1.5 py-0.5 text-[10px] rounded opacity-40 hover:opacity-100 hover:bg-white/10 transition-all"
              onClick={props.onUnresolve}
              title={tt('repo.conflictBlockUnresolved')}
            >
              ↩
            </button>
          </Show>
        </div>
      </div>

      {/* Block content: side-by-side */}
      <div class="p-3">
        <div class="grid grid-cols-2 gap-2">
          {/* OURS */}
          <div class="min-h-0">
            <div class="flex items-center gap-1 mb-1">
              <span class="text-[10px] font-semibold text-cyan-400">Ours</span>
              <button
                class={`ml-auto px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  props.resolution === 'ours'
                    ? 'bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/50'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300'
                }`}
                onClick={props.onUseOurs}
              >
                {props.resolution === 'ours' ? `✓ ${tt('repo.conflictUseOurs')}` : tt('repo.conflictUseOurs')}
              </button>
            </div>
            <pre class="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-52 overflow-auto p-2 rounded bg-black/20 border border-white/5">
              <For each={props.highlights.ours}>
                {(html) => (
                  <div innerHTML={html} />
                )}
              </For>
            </pre>
          </div>

          {/* THEIRS */}
          <div class="min-h-0">
            <div class="flex items-center gap-1 mb-1">
              <span class="text-[10px] font-semibold text-purple-400">Theirs</span>
              <button
                class={`ml-auto px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  props.resolution === 'theirs'
                    ? 'bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50'
                    : 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300'
                }`}
                onClick={props.onUseTheirs}
              >
                {props.resolution === 'theirs' ? `✓ ${tt('repo.conflictUseTheirs')}` : tt('repo.conflictUseTheirs')}
              </button>
            </div>
            <pre class="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-52 overflow-auto p-2 rounded bg-black/20 border border-white/5">
              <For each={props.highlights.theirs}>
                {(html) => (
                  <div innerHTML={html} />
                )}
              </For>
            </pre>
          </div>
        </div>

        {/* Manual edit section */}
        <div class="mt-2">
          <Show
            when={props.isEditing}
            fallback={
              <button
                class={`w-full py-1 text-[10px] rounded transition-colors ${
                  props.resolution === 'manual'
                    ? 'bg-green-500/20 text-green-300 ring-1 ring-green-500/30'
                    : 'bg-white/5 hover:bg-white/10 opacity-60 hover:opacity-100'
                }`}
                onClick={props.onManualEdit}
              >
                {props.resolution === 'manual' ? `✏️ ${tt('repo.conflictBlockResolvedManual')}` : `✏️ ${tt('repo.conflictEditManual')}`}
              </button>
            }
          >
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-semibold text-green-400">{tt('repo.conflictBlockResolvedManual')}</span>
                <div class="flex gap-1">
                  <button
                    class="px-1.5 py-0.5 text-[10px] rounded bg-green-500/30 hover:bg-green-500/50 text-green-200 transition-colors"
                    onClick={props.onApplyManual}
                  >
                    ✓ {tt('repo.conflictApplyManual')}
                  </button>
                  <button
                    class="px-1.5 py-0.5 text-[10px] rounded bg-white/10 hover:bg-white/20 transition-colors"
                    onClick={() => props.onUpdateManual(props.block.ours)}
                  >
                    {tt('repo.conflictResetManual')}
                  </button>
                </div>
              </div>
              <textarea
                class="w-full h-32 text-[11px] font-mono leading-relaxed p-2 rounded bg-black/30 border border-green-500/30 text-white placeholder-white/20 resize-y focus:outline-none focus:border-green-500/50"
                value={props.manualContent}
                onInput={(e) => props.onUpdateManual(e.currentTarget.value)}
                placeholder={tt('repo.conflictEditManual')}
              />
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
