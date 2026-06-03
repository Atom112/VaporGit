import { Component, createSignal, Show, For, createMemo, onMount } from 'solid-js';
import { getConflicts, resolveConflict, getConflictContent } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt, ttf } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import type { ConflictEntry } from '../../lib/types';

interface Props {
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

interface ConflictBlock {
  ours: string;
  theirs: string;
  fullMatch: string;
}

function parseConflictMarkers(content: string): ConflictBlock[] {
  const blocks: ConflictBlock[] = [];
  const regex = /<<<<<<< .*?\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> .*?(?:\n|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
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
  const [oursContent, setOursContent] = createSignal<string>('');
  const [theirsContent, setTheirsContent] = createSignal<string>('');
  const [contentLoading, setContentLoading] = createSignal(false);
  const [resolving, setResolving] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [activeTab, setActiveTab] = createSignal<'local' | 'remote' | 'conflicts'>('conflicts');

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
    setOursContent('');
    setTheirsContent('');
    try {
      const [ours, theirs] = await Promise.all([
        getConflictContent(props.repoPath, filePath, 'ours'),
        getConflictContent(props.repoPath, filePath, 'theirs'),
      ]);
      setOursContent(ours);
      setTheirsContent(theirs);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setContentLoading(false);
    }
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
        setOursContent('');
        setTheirsContent('');
      }
    } catch (e) {
      addToast(ttf('repo.conflictResolveFailed', String(e)), 'error');
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
        addToast(ttf('repo.conflictResolveFailed', String(e)), 'error');
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
    const content = activeTab() === 'local' ? oursContent() :
                    activeTab() === 'remote' ? theirsContent() :
                    oursContent(); // default to ours for conflict parsing
    if (!content) return [];
    return parseConflictMarkers(content);
  });

  const renderContent = (content: string) => {
    if (!content) {
      return (
        <div class="flex items-center justify-center h-full text-sm opacity-40">
          {tt('repo.conflictNoConflicts')}
        </div>
      );
    }
    return (
      <pre class="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all select-text">
        {content.length > 50000 ? content.slice(0, 50000) + '\n... (truncated)' : content}
      </pre>
    );
  };

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

        {/* Main content: file list + content view */}
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
                        <button
                          class="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 disabled:opacity-30 shrink-0 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleResolve(conflict.filePath, 'ours'); }}
                          disabled={resolving() === conflict.filePath}
                        >
                          {tt('repo.conflictUseOurs')}
                        </button>
                        <button
                          class="px-1.5 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 disabled:opacity-30 shrink-0 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleResolve(conflict.filePath, 'theirs'); }}
                          disabled={resolving() === conflict.filePath}
                        >
                          {tt('repo.conflictUseTheirs')}
                        </button>
                      </div>
                    )}
                  </For>
                </Show>
              </Show>
            </div>
          </div>

          {/* Right: content comparison view */}
          <div class="flex-1 flex flex-col min-h-0">
            <Show
              when={selectedFile()}
              fallback={
                <div class="flex-1 flex items-center justify-center text-sm opacity-40">
                  {tt('repo.conflictSelectFile')}
                </div>
              }
            >
              {/* File name header */}
              <div class="px-4 py-2 border-b border-white/10 bg-white/5 shrink-0">
                <span class="text-xs font-mono font-medium opacity-80">{selectedFile()}</span>
              </div>

              {/* Tab bar */}
              <div class="flex border-b border-white/10 shrink-0">
                <button
                  class={`px-4 py-1.5 text-xs font-medium transition-colors ${
                    activeTab() === 'local'
                      ? 'text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setActiveTab('local')}
                >
                  {tt('repo.conflictLocal')}
                </button>
                <button
                  class={`px-4 py-1.5 text-xs font-medium transition-colors ${
                    activeTab() === 'remote'
                      ? 'text-purple-400 border-b-2 border-b-purple-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setActiveTab('remote')}
                >
                  {tt('repo.conflictRemote')}
                </button>
                <button
                  class={`px-4 py-1.5 text-xs font-medium transition-colors ${
                    activeTab() === 'conflicts'
                      ? 'text-yellow-400 border-b-2 border-b-yellow-400'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  onClick={() => setActiveTab('conflicts')}
                >
                  {tt('repo.conflictFinal')}
                </button>
              </div>

              {/* Content area */}
              <div class="flex-1 overflow-auto p-4">
                <Show
                  when={!contentLoading()}
                  fallback={
                    <div class="flex items-center justify-center h-full text-sm opacity-40">
                      {tt('repo.conflictLoadingContent')}
                    </div>
                  }
                >
                  {/* LOCAL tab */}
                  <Show when={activeTab() === 'local'}>
                    <div class="h-full">
                      <div class="p-3 rounded-lg bg-[#2a2a2e] border border-white/10 overflow-auto max-h-full">
                        {renderContent(oursContent())}
                      </div>
                    </div>
                  </Show>

                  {/* REMOTE tab */}
                  <Show when={activeTab() === 'remote'}>
                    <div class="h-full">
                      <div class="p-3 rounded-lg bg-[#2a2a2e] border border-white/10 overflow-auto max-h-full">
                        {renderContent(theirsContent())}
                      </div>
                    </div>
                  </Show>

                  {/* CONFLICTS tab - show parsed conflict blocks */}
                  <Show when={activeTab() === 'conflicts'}>
                    <Show
                      when={conflictBlocks().length > 0}
                      fallback={
                        <Show when={oursContent() || theirsContent()}>
                          <div class="space-y-3">
                            <div class="p-3 rounded-lg bg-[#2a2a2e] border border-white/10">
                              <div class="flex gap-2 items-center mb-2">
                                <span class="text-xs font-semibold text-cyan-400">{tt('repo.conflictLocal')}</span>
                                <button
                                  class="ml-auto px-2 py-0.5 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
                                  onClick={() => handleResolve(selectedFile()!, 'ours')}
                                  disabled={resolving() === selectedFile()}
                                >
                                  {tt('repo.conflictUseOurs')}
                                </button>
                              </div>
                              <pre class="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all max-h-60 overflow-auto">
                                {oursContent()}
                              </pre>
                            </div>
                            <div class="p-3 rounded-lg bg-[#2a2a2e] border border-white/10">
                              <div class="flex gap-2 items-center mb-2">
                                <span class="text-xs font-semibold text-purple-400">{tt('repo.conflictRemote')}</span>
                                <button
                                  class="ml-auto px-2 py-0.5 text-xs rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                                  onClick={() => handleResolve(selectedFile()!, 'theirs')}
                                  disabled={resolving() === selectedFile()}
                                >
                                  {tt('repo.conflictUseTheirs')}
                                </button>
                              </div>
                              <pre class="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all max-h-60 overflow-auto">
                                {theirsContent()}
                              </pre>
                            </div>
                          </div>
                        </Show>
                      }
                    >
                      <div class="space-y-4">
                        <div class="flex gap-2">
                          <button
                            class="flex-1 py-1.5 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                            onClick={() => handleResolve(selectedFile()!, 'ours')}
                            disabled={resolving() === selectedFile()}
                          >
                            {tt('repo.conflictUseOurs')}
                          </button>
                          <button
                            class="flex-1 py-1.5 text-xs rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 disabled:opacity-30 transition-colors"
                            onClick={() => handleResolve(selectedFile()!, 'theirs')}
                            disabled={resolving() === selectedFile()}
                          >
                            {tt('repo.conflictUseTheirs')}
                          </button>
                        </div>
                        <For each={conflictBlocks()}>
                          {(block, index) => (
                            <div class="p-3 rounded-lg bg-[#2a2a2e] border border-yellow-500/20">
                              <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-semibold opacity-60">
                                  {tt('repo.conflictFinal')} #{index() + 1}
                                </span>
                              </div>
                              <div class="grid grid-cols-2 gap-2">
                                <div>
                                  <div class="flex items-center gap-2 mb-1">
                                    <span class="text-[10px] font-semibold text-cyan-400">{tt('repo.conflictLocal')}</span>
                                    <button
                                      class="ml-auto px-1.5 py-0.5 text-[10px] rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                                      onClick={() => handleResolve(selectedFile()!, 'ours')}
                                      disabled={resolving() === selectedFile()}
                                    >
                                      {tt('repo.conflictUseOurs')}
                                    </button>
                                  </div>
                                  <pre class="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-auto p-2 rounded bg-black/20 border border-white/5">
                                    {block.ours}
                                  </pre>
                                </div>
                                <div>
                                  <div class="flex items-center gap-2 mb-1">
                                    <span class="text-[10px] font-semibold text-purple-400">{tt('repo.conflictRemote')}</span>
                                    <button
                                      class="ml-auto px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 transition-colors"
                                      onClick={() => handleResolve(selectedFile()!, 'theirs')}
                                      disabled={resolving() === selectedFile()}
                                    >
                                      {tt('repo.conflictUseTheirs')}
                                    </button>
                                  </div>
                                  <pre class="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-auto p-2 rounded bg-black/20 border border-white/5">
                                    {block.theirs}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </For>
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
          <Show when={!loading()}>
            <div class="flex gap-2">
              <button
                class="px-3 py-1 text-xs rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 disabled:opacity-30 transition-colors"
                onClick={() => handleResolveAll('ours')}
                disabled={conflicts().length === 0}
              >
                {tt('repo.conflictUseAllOurs')}
              </button>
              <button
                class="px-3 py-1 text-xs rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 disabled:opacity-30 transition-colors"
                onClick={() => handleResolveAll('theirs')}
                disabled={conflicts().length === 0}
              >
                {tt('repo.conflictUseAllTheirs')}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
