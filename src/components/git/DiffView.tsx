import { Component, For, Show, createSignal, createResource, createEffect, createMemo } from 'solid-js';
import type { DiffHunk, DiffResult } from '../../lib/types';
import { getFileContent, getFileBase64, checkLfs, stageHunk, stageLine } from '../../lib/tauriCommands';
import { addToast } from '../../stores/toastStore';
import { tt } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';
import 'highlight.js/styles/github-dark.css';
import { detectLanguage, highlightLine, highlightLines, highlightFull } from '../../lib/syntax';
import { settingsStore } from '../../stores/settingsStore';
import { createVirtualizer } from '@tanstack/solid-virtual';

interface DiffViewProps {
  diffResult?: DiffResult;
  loading: boolean;
  filePath: string;
  onBack?: () => void;
  commitId?: string;
  repoPath?: string;
  onRefreshStatus?: () => void;
}

interface LineNumPair {
  oldLine: number | null;
  newLine: number | null;
}

const DIFF_ROW_ESTIMATE = 22;

function computeLineNums(hunk: DiffHunk): LineNumPair[] {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const result: LineNumPair[] = [];

  for (const line of hunk.lines) {
    switch (line.kind) {
      case 'context':
        result.push({ oldLine: oldLine++, newLine: newLine++ });
        break;
      case 'addition':
        result.push({ oldLine: null, newLine: newLine++ });
        break;
      case 'deletion':
        result.push({ oldLine: oldLine++, newLine: null });
        break;
    }
  }

  return result;
}

function buildFullFileLines(
  hunks: DiffHunk[],
  contentLines: string[],
): { oldLine: number | null; newLine: number | null; kind: 'context' | 'addition' | 'deletion' }[] {
  const annotations: ('context' | 'addition')[] = Array.from({ length: contentLines.length }, () => 'context');
  const deletions: { beforeNewLine: number }[] = [];

  for (const hunk of hunks) {
    let newLineOffset = 0;
    for (const line of hunk.lines) {
      if (line.kind === 'deletion') {
        deletions.push({ beforeNewLine: hunk.newStart + newLineOffset });
      } else {
        const idx = hunk.newStart - 1 + newLineOffset;
        if (idx >= 0 && idx < contentLines.length) {
          annotations[idx] = line.kind;
        }
        newLineOffset++;
      }
    }
  }

  deletions.sort((a, b) => a.beforeNewLine - b.beforeNewLine);

  const result: { oldLine: number | null; newLine: number | null; kind: 'context' | 'addition' | 'deletion' }[] = [];
  let delIdx = 0;

  for (let i = 0; i < contentLines.length; i++) {
    while (delIdx < deletions.length && deletions[delIdx].beforeNewLine <= i + 1) {
      result.push({ oldLine: null, newLine: null, kind: 'deletion' });
      delIdx++;
    }
    result.push({ oldLine: i + 1, newLine: i + 1, kind: annotations[i] });
  }

  while (delIdx < deletions.length) {
    result.push({ oldLine: null, newLine: null, kind: 'deletion' });
    delIdx++;
  }

  return result;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.includes(ext) : false;
}

const DiffView: Component<DiffViewProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'unified' | 'fullFile' | 'split'>(settingsStore.defaultDiffView);

  createEffect(() => {
    setViewMode(settingsStore.defaultDiffView);
  });

  // Image preview for binary files
  const [imageDataUrl] = createResource(
    () => props.diffResult?.isBinary && isImageFile(props.filePath) && props.repoPath
      ? { repoPath: props.repoPath, filePath: props.filePath, commitId: props.commitId }
      : null,
    async ({ repoPath, filePath, commitId }) => {
      try {
        return await getFileBase64(repoPath, filePath, commitId);
      } catch { return null; }
    },
  );

  // LFS check
  const [isLfs] = createResource(
    () => props.diffResult?.isBinary && props.repoPath
      ? { repoPath: props.repoPath, filePath: props.filePath }
      : null,
    async ({ repoPath, filePath }) => {
      try { return await checkLfs(repoPath, filePath); }
      catch { return false; }
    },
  );

  const [fullContent] = createResource(
    () =>
      viewMode() === 'fullFile' && props.diffResult && !props.diffResult.isBinary && !props.diffResult.isTooLarge
        ? { filePath: props.filePath, commitId: props.commitId, repoPath: props.repoPath }
        : null,
    async ({ filePath, commitId, repoPath }) => {
      if (!repoPath) return null;
      try {
        return await getFileContent(repoPath, filePath, commitId);
      } catch {
        return null;
      }
    },
  );

  const lang = () => detectLanguage(props.filePath);

  return (
    <div class="flex flex-col h-full min-h-0">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <Show when={props.onBack}>
            <button
              class="text-xs opacity-60 hover:opacity-100 transition-opacity shrink-0"
              onClick={props.onBack}
            >
              ← 返回
            </button>
          </Show>
          <span class="text-sm font-mono opacity-80 truncate">{props.filePath}</span>
        </div>
        <Show when={props.diffResult && !props.diffResult.isBinary && !props.diffResult.isTooLarge}>
          <div class="flex items-center gap-1 shrink-0">
            <button
              class={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode() === 'unified'
                  ? 'bg-cyan-500/30 text-cyan-300'
                  : 'opacity-50 hover:opacity-80'
              }`}
              onClick={() => setViewMode('unified')}
            >
              Unified
            </button>
            <button
              class={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode() === 'split'
                  ? 'bg-cyan-500/30 text-cyan-300'
                  : 'opacity-50 hover:opacity-80'
              }`}
              onClick={() => setViewMode('split')}
            >
              Split
            </button>
            <button
              class={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode() === 'fullFile'
                  ? 'bg-cyan-500/30 text-cyan-300'
                  : 'opacity-50 hover:opacity-80'
              }`}
              onClick={() => setViewMode('fullFile')}
            >
              Full File
            </button>
          </div>
        </Show>
      </div>

      {/* Content */}
      <For each={[props.filePath]}>
        {() => (
          <div class="flex-1 overflow-hidden font-mono text-sm animate-content-enter">
            <Show when={!props.loading} fallback={
              <div class="flex items-center justify-center h-full opacity-40">加载中...</div>
            }>
              <Show
                when={props.diffResult && !props.diffResult.isBinary && !props.diffResult.isTooLarge}
                fallback={
                  <Show when={props.diffResult?.isBinary} fallback={
                    <div class="flex items-center justify-center h-full opacity-40 text-sm">
                      {props.diffResult?.isTooLarge ? '文件过大，无法显示完整差异' : '无差异内容'}
                    </div>
                  }>
                    <Show when={isImageFile(props.filePath) && imageDataUrl() !== undefined}
                      fallback={
                        <div class="flex flex-col items-center justify-center h-full gap-3">
                          <svg class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span class="text-sm opacity-50">二进制文件</span>
                          <Show when={isLfs() !== undefined && isLfs()}>
                            <span class="text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                              LFS
                            </span>
                          </Show>
                        </div>
                      }
                    >
                      <div class="flex flex-col items-center justify-center h-full gap-2 p-4">
                        <Show when={imageDataUrl()}
                          fallback={
                            <div class="flex items-center justify-center opacity-40 text-sm">加载预览中...</div>
                          }
                        >
                          <img
                            src={imageDataUrl()!}
                            alt={props.filePath}
                            class="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                          />
                        </Show>
                        <span class="text-xs opacity-40">{props.filePath}</span>
                        <Show when={isLfs()}>
                          <span class="text-xs px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                             Git LFS
                          </span>
                        </Show>
                      </div>
                    </Show>
                  </Show>
                }
              >
                {viewMode() === 'unified' ? (
                  <UnifiedView
                    diffResult={props.diffResult!}
                    lang={lang()}
                    repoPath={props.repoPath}
                    filePath={props.filePath}
                    onRefreshStatus={props.onRefreshStatus}
                    commitId={props.commitId}
                  />
                ) : viewMode() === 'split' ? (
                  <SplitView
                    diffResult={props.diffResult!}
                    lang={lang()}
                    repoPath={props.repoPath}
                    filePath={props.filePath}
                    onRefreshStatus={props.onRefreshStatus}
                    commitId={props.commitId}
                  />
                ) : (
                  <Show when={fullContent() !== undefined} fallback={
                    <div class="flex items-center justify-center h-full opacity-40">加载完整文件...</div>
                  }>
                    <Show when={fullContent() !== null} fallback={
                      <div class="flex items-center justify-center h-full opacity-40">无法读取文件内容</div>
                    }>
                      <FullFileView
                        diffResult={props.diffResult!}
                        fullContent={fullContent()!}
                        lang={lang()}
                      />
                    </Show>
                  </Show>
                )}
              </Show>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};

/* ── Unified view with hunk/line staging ── */
interface StageableViewProps {
  diffResult: DiffResult;
  lang: string | null;
  repoPath?: string;
  filePath: string;
  onRefreshStatus?: () => void;
  commitId?: string;
}

const UnifiedView: Component<StageableViewProps> = (props) => {
  let parentRef: HTMLDivElement | undefined;
  const [stagingHunk, setStagingHunk] = createSignal<number | null>(null);
  const [stagingLine, setStagingLine] = createSignal<{ hunk: number; line: number } | null>(null);

  const handleStageHunk = async (hunkIndex: number) => {
    if (!props.repoPath) return;
    setStagingHunk(hunkIndex);
    try {
      await stageHunk(props.repoPath, props.filePath, hunkIndex);
      addToast(tt('repo.hunkStaged'), 'success');
      props.onRefreshStatus?.();
    } catch (e) {
      addToast(`暂存 hunk 失败: ${describeError(e)}`, 'error');
    } finally {
      setStagingHunk(null);
    }
  };

  const handleStageLine = async (hunkIndex: number, lineIndex: number) => {
    if (!props.repoPath) return;
    setStagingLine({ hunk: hunkIndex, line: lineIndex });
    try {
      await stageLine(props.repoPath, props.filePath, hunkIndex, lineIndex);
      addToast(tt('repo.lineStaged'), 'success');
      props.onRefreshStatus?.();
    } catch (e) {
      addToast(`暂存行失败: ${describeError(e)}`, 'error');
    } finally {
      setStagingLine(null);
    }
  };

  // Only show stage buttons when viewing working tree changes (no commitId)
  const showStageButtons = () => !props.commitId && props.repoPath;

  // Pre-compute highlighted HTML for all hunks in one batch per hunk (1 hljs call per hunk instead of per line)
  const hunkHighlights = createMemo(() => {
    return props.diffResult.hunks.map((hunk) => {
      const textLines = hunk.lines.map((l) => l.content.replace(/\n$/, ''));
      return highlightLines(textLines, props.lang);
    });
  });

  // Pre-compute line numbers for each hunk
  const hunkLineNums = createMemo(() => {
    return props.diffResult.hunks.map((hunk) => computeLineNums(hunk));
  });

  type UnifiedRow =
    | { type: 'hunk'; hunkIndex: number; header: string }
    | { type: 'line'; hunkIndex: number; lineIndex: number };

  const rows = createMemo<UnifiedRow[]>(() => {
    const result: UnifiedRow[] = [];
    props.diffResult.hunks.forEach((hunk, hunkIndex) => {
      result.push({ type: 'hunk', hunkIndex, header: hunk.header });
      hunk.lines.forEach((_, lineIndex) => {
        result.push({ type: 'line', hunkIndex, lineIndex });
      });
    });
    return result;
  });

  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return rows().length;
    },
    getScrollElement: () => parentRef ?? null,
    estimateSize: () => DIFF_ROW_ESTIMATE,
    overscan: 16,
  });

  return (
    <div ref={(el) => { parentRef = el; }} class="h-full overflow-auto">
      <div
        class="relative"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        <For each={rowVirtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const row = rows()[virtualRow.index];
            if (!row) return null;

            return (
              <div
                ref={(el) => rowVirtualizer.measureElement(el)}
                data-index={virtualRow.index}
                class="absolute left-0 right-0"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <Show
                  when={row.type === 'line'}
                  fallback={
                    <div class="bg-white/5 px-3 py-1 text-xs text-cyan-400 font-semibold flex items-center gap-2 group border-b border-white/5">
                      <span class="flex-1">{(row as Extract<UnifiedRow, { type: 'hunk' }>).header}</span>
                      <Show when={showStageButtons()}>
                        <button
                          class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleStageHunk(row.hunkIndex)}
                          disabled={stagingHunk() === row.hunkIndex}
                        >
                          {stagingHunk() === row.hunkIndex ? '...' : `+ ${tt('repo.stageHunk')}`}
                        </button>
                      </Show>
                    </div>
                  }
                >
                  {(() => {
                    const lineRow = row as Extract<UnifiedRow, { type: 'line' }>;
                    const line = props.diffResult.hunks[lineRow.hunkIndex]?.lines[lineRow.lineIndex];
                    const nums = hunkLineNums()[lineRow.hunkIndex]?.[lineRow.lineIndex];
                    const html = hunkHighlights()[lineRow.hunkIndex]?.[lineRow.lineIndex] ?? '';
                    if (!line || !nums) return null;

                    let bgClass = '';
                    let prefix = ' ';
                    let prefixColor = 'opacity-30';
                    if (line.kind === 'addition') {
                      bgClass = 'bg-green-500/10';
                      prefix = '+';
                      prefixColor = 'text-green-400';
                    } else if (line.kind === 'deletion') {
                      bgClass = 'bg-red-500/10';
                      prefix = '-';
                      prefixColor = 'text-red-400';
                    }
                    const isStagingLine = showStageButtons() && (line.kind === 'addition' || line.kind === 'deletion');

                    return (
                      <div class={`flex items-stretch ${bgClass} group/line border-b border-white/[0.02]`}>
                        <Show when={isStagingLine}>
                          <div class="w-4 shrink-0 flex items-center justify-center opacity-0 group-hover/line:opacity-100 transition-opacity">
                            <button
                              class="text-[10px] leading-none text-green-400 hover:text-green-300"
                              onClick={() => handleStageLine(lineRow.hunkIndex, lineRow.lineIndex)}
                              disabled={stagingLine()?.hunk === lineRow.hunkIndex && stagingLine()?.line === lineRow.lineIndex}
                              title={tt('repo.stageLine')}
                              aria-label={tt('repo.stageLine')}
                            >
                              +
                            </button>
                          </div>
                        </Show>
                        <div class="w-12 shrink-0 text-right text-xs opacity-35 select-none px-1 py-0 tabular-nums leading-normal">
                          {nums.oldLine ?? ''}
                        </div>
                        <span class="opacity-25 select-none leading-normal">│</span>
                        <div class="w-12 shrink-0 text-right text-xs opacity-35 select-none px-1 py-0 tabular-nums leading-normal">
                          {nums.newLine ?? ''}
                        </div>
                        <span class="opacity-25 select-none leading-normal mx-1">│</span>
                        <span class={`w-5 shrink-0 text-right select-none leading-normal ${prefixColor}`}>
                          {prefix}
                        </span>
                        <span class="whitespace-pre-wrap break-all leading-normal" innerHTML={html} />
                      </div>
                    );
                  })()}
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

/* ── Full File view: show complete file with change annotations ── */
const FullFileView: Component<{ diffResult: DiffResult; fullContent: string; lang: string | null }> = (props) => {
  let parentRef: HTMLDivElement | undefined;
  const normalized = () => {
    const c = props.fullContent;
    const s = c.endsWith('\n') ? c.slice(0, -1) : c;
    return s === '' ? [] : s.split('\n');
  };

  const annotatedLines = () => buildFullFileLines(props.diffResult.hunks, normalized());

  const highlightedLines = () => highlightFull(props.fullContent, props.lang);

  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return annotatedLines().length;
    },
    getScrollElement: () => parentRef ?? null,
    estimateSize: () => DIFF_ROW_ESTIMATE,
    overscan: 16,
  });

  return (
    <div ref={(el) => { parentRef = el; }} class="h-full overflow-auto">
      <div
        class="relative"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        <For each={rowVirtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const annot = annotatedLines()[virtualRow.index];
            if (!annot) return null;
            const lineHtml = highlightedLines()[virtualRow.index] ?? '';
            let bgClass = '';
            let gutterColor = 'bg-transparent';
            if (annot.kind === 'addition') {
              bgClass = 'bg-green-500/10';
              gutterColor = 'bg-green-400';
            } else if (annot.kind === 'deletion') {
              bgClass = 'bg-red-500/10';
              gutterColor = 'bg-red-400';
            }
            return (
              <div
                ref={(el) => rowVirtualizer.measureElement(el)}
                data-index={virtualRow.index}
                class="absolute left-0 right-0"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div class={`flex items-stretch ${bgClass}`}>
                  <div class={`w-0.75 shrink-0 ${gutterColor}`} />
                  <div class="w-12 shrink-0 text-right text-xs opacity-35 select-none px-1 py-0 tabular-nums leading-normal">
                    {annot.newLine ?? ''}
                  </div>
                  <span class="opacity-25 select-none leading-normal">│</span>
                  <span class={`whitespace-pre-wrap break-all leading-normal ${annot.kind === 'deletion' ? 'opacity-60' : ''}`}
                    innerHTML={lineHtml} />
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};

/* ── Side-by-side Split view with hunk/line staging ── */
interface SplitRow {
  type: 'line';
  left: { content: string; kind: string; lineNum: number | null } | null;
  right: { content: string; kind: string; lineNum: number | null } | null;
}

type SplitVirtualRow =
  | { type: 'hunk'; hunkIndex: number; header: string }
  | (SplitRow & { hunkIndex: number });

const SplitView: Component<StageableViewProps> = (props) => {
  let parentRef: HTMLDivElement | undefined;

  const [stagingHunk, setStagingHunk] = createSignal<number | null>(null);

  const handleStageHunk = async (hunkIndex: number) => {
    if (!props.repoPath) return;
    setStagingHunk(hunkIndex);
    try {
      await stageHunk(props.repoPath, props.filePath, hunkIndex);
      addToast(tt('repo.hunkStaged'), 'success');
      props.onRefreshStatus?.();
    } catch (e) {
      addToast(`暂存 hunk 失败: ${describeError(e)}`, 'error');
    } finally {
      setStagingHunk(null);
    }
  };

  const showStageButtons = () => !props.commitId && props.repoPath;

  const rows = createMemo((): SplitVirtualRow[] => {
    const result: SplitVirtualRow[] = [];
    props.diffResult.hunks.forEach((hunk, hunkIndex) => {
      result.push({ type: 'hunk', hunkIndex, header: hunk.header });
      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;
      for (const line of hunk.lines) {
        if (line.kind === 'context') {
          result.push({
            type: 'line',
            hunkIndex,
            left: { content: line.content, kind: 'context', lineNum: oldLine },
            right: { content: line.content, kind: 'context', lineNum: newLine },
          });
          oldLine++;
          newLine++;
        } else if (line.kind === 'deletion') {
          result.push({
            type: 'line',
            hunkIndex,
            left: { content: line.content, kind: 'deletion', lineNum: oldLine },
            right: null,
          });
          oldLine++;
        } else if (line.kind === 'addition') {
          result.push({
            type: 'line',
            hunkIndex,
            left: null,
            right: { content: line.content, kind: 'addition', lineNum: newLine },
          });
          newLine++;
        }
      }
    });
    return result;
  });

  const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    get count() {
      return rows().length;
    },
    getScrollElement: () => parentRef ?? null,
    estimateSize: () => DIFF_ROW_ESTIMATE,
    overscan: 16,
  });

  const renderSplitCell = (segment: SplitRow['left'], side: 'left' | 'right') => {
    if (!segment) {
      return (
        <div class="flex h-full min-h-5 bg-black/20">
          <div class="w-12 shrink-0" />
          <span class="opacity-25">│</span>
        </div>
      );
    }
    const bgClass = segment.kind === 'deletion'
      ? 'bg-red-500/10'
      : segment.kind === 'addition'
        ? 'bg-green-500/10'
        : '';
    const textClass = side === 'left' && segment.kind === 'deletion'
      ? 'text-red-100'
      : side === 'right' && segment.kind === 'addition'
        ? 'text-green-100'
        : '';
    return (
      <div class={`flex items-stretch min-h-5 ${bgClass}`}>
        <div class="w-12 shrink-0 text-right text-xs opacity-35 select-none px-1 py-0 tabular-nums leading-normal">
          {segment.lineNum ?? ''}
        </div>
        <span class="opacity-25 select-none leading-normal">│</span>
        <span class={`whitespace-pre-wrap break-all leading-normal ${textClass}`} innerHTML={highlightLine(segment.content, props.lang)} />
      </div>
    );
  };

  return (
    <div class="flex flex-col h-full">
      <div class="grid grid-cols-2 shrink-0 bg-white/5 border-b border-white/10 text-xs font-semibold">
        <div class="px-3 py-1 text-red-400 border-r border-white/10">旧版本</div>
        <div class="px-3 py-1 text-green-400">新版本</div>
      </div>
      <div ref={(el) => { parentRef = el; }} class="flex-1 overflow-auto">
        <div
          class="relative"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          <For each={rowVirtualizer.getVirtualItems()}>
            {(virtualRow) => {
              const row = rows()[virtualRow.index];
              if (!row) return null;
              return (
                <div
                  ref={(el) => rowVirtualizer.measureElement(el)}
                  data-index={virtualRow.index}
                  class="absolute left-0 right-0"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <Show
                    when={row.type === 'line'}
                    fallback={
                      <div class="bg-white/5 px-3 py-1 text-xs text-cyan-400/70 font-semibold flex items-center gap-2 border-b border-white/5">
                        <span class="flex-1">{(row as Extract<SplitVirtualRow, { type: 'hunk' }>).header}</span>
                        <Show when={showStageButtons()}>
                          <button
                            class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-opacity shrink-0"
                            onClick={() => handleStageHunk(row.hunkIndex)}
                            disabled={stagingHunk() === row.hunkIndex}
                          >
                            {stagingHunk() === row.hunkIndex ? '...' : `+ ${tt('repo.stageHunk')}`}
                          </button>
                        </Show>
                      </div>
                    }
                  >
                    {(() => {
                      const lineRow = row as Extract<SplitVirtualRow, { type: 'line' }>;
                      return (
                        <div class="grid grid-cols-2 border-b border-white/[0.02]">
                          <div class="border-r border-white/10 min-w-0">
                            {renderSplitCell(lineRow.left, 'left')}
                          </div>
                          <div class="min-w-0">
                            {renderSplitCell(lineRow.right, 'right')}
                          </div>
                        </div>
                      );
                    })()}
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};

export default DiffView;
