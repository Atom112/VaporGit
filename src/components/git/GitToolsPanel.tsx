import { Component, createEffect, createSignal, For, Show } from 'solid-js';
import {
  checkSubmodules,
  deleteTag,
  getReflog,
  gitBlame,
  lfsPull,
  lfsTrack,
  lfsUntrack,
  listTags,
  submoduleAdd,
  submoduleInit,
  submoduleUpdate,
  testSshConnection,
} from '../../lib/tauriCommands';
import type { BlameLine, ReflogEntry, TagInfo } from '../../lib/types';
import { describeError } from '../../lib/gitErrorDesc';
import { addToast } from '../../stores/toastStore';
import { tt } from '../../i18n';

type ToolTab = 'tags' | 'submodules' | 'blame' | 'reflog' | 'lfs' | 'ssh';

interface Props {
  repoPath: string;
  selectedFile?: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const tabs: Array<{ id: ToolTab; label: string }> = [
  { id: 'tags', label: 'Tags' },
  { id: 'submodules', label: 'Submodules' },
  { id: 'blame', label: 'Blame' },
  { id: 'reflog', label: 'Reflog' },
  { id: 'lfs', label: 'LFS' },
  { id: 'ssh', label: 'SSH' },
];

const inputClass =
  'w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400/50 placeholder-white/30';

const primaryButtonClass =
  'px-3 py-1.5 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 text-xs font-medium transition-colors';

const secondaryButtonClass =
  'px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-xs font-medium transition-colors';

const dangerButtonClass =
  'px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 text-xs font-medium text-red-200 transition-colors';

function formatReflogTime(timestamp: number) {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleString();
}

const GitToolsPanel: Component<Props> = (props) => {
  const [phase, setPhase] = createSignal<'enter' | 'exit'>('enter');
  const [activeTab, setActiveTab] = createSignal<ToolTab>('tags');
  const [busy, setBusy] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const [tags, setTags] = createSignal<TagInfo[]>([]);
  const [submodules, setSubmodules] = createSignal<string[]>([]);
  const [submoduleUrl, setSubmoduleUrl] = createSignal('');
  const [submodulePath, setSubmodulePath] = createSignal('');
  const [blamePath, setBlamePath] = createSignal(props.selectedFile ?? '');
  const [blameLines, setBlameLines] = createSignal<BlameLine[]>([]);
  const [reflogRef, setReflogRef] = createSignal('HEAD');
  const [reflogEntries, setReflogEntries] = createSignal<ReflogEntry[]>([]);
  const [lfsPattern, setLfsPattern] = createSignal('');
  const [operationOutput, setOperationOutput] = createSignal('');
  const [sshHost, setSshHost] = createSignal('github.com');
  const [sshKeyPath, setSshKeyPath] = createSignal('');

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    setOperationOutput('');
    try {
      await action();
    } catch (e) {
      const message = describeError(e);
      setError(message);
      addToast(message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const loadTags = async () => {
    await run('tags', async () => {
      setTags(await listTags(props.repoPath));
    });
  };

  const loadSubmodules = async () => {
    await run('submodules', async () => {
      setSubmodules(await checkSubmodules(props.repoPath));
    });
  };

  const loadReflog = async () => {
    await run('reflog', async () => {
      setReflogEntries(await getReflog(props.repoPath, reflogRef().trim() || undefined));
    });
  };

  createEffect(() => {
    if (!props.repoPath) return;
    void loadTags();
    void loadSubmodules();
  });

  const handleClose = () => {
    setPhase('exit');
    setTimeout(() => props.onClose(), 120);
  };

  const handleDeleteTag = async (tagName: string) => {
    await run(`delete-tag-${tagName}`, async () => {
      await deleteTag(props.repoPath, tagName);
      addToast(`Deleted tag ${tagName}`, 'success');
      await loadTags();
      props.onRefresh?.();
    });
  };

  const handleAddSubmodule = async () => {
    const url = submoduleUrl().trim();
    const path = submodulePath().trim();
    if (!url || !path) return;
    await run('submodule-add', async () => {
      setOperationOutput(await submoduleAdd(props.repoPath, url, path));
      setSubmoduleUrl('');
      setSubmodulePath('');
      await loadSubmodules();
      props.onRefresh?.();
    });
  };

  const handleSubmoduleInit = async () => {
    await run('submodule-init', async () => {
      setOperationOutput(await submoduleInit(props.repoPath));
      await loadSubmodules();
    });
  };

  const handleSubmoduleUpdate = async () => {
    await run('submodule-update', async () => {
      setOperationOutput(await submoduleUpdate(props.repoPath, true));
      await loadSubmodules();
    });
  };

  const handleBlame = async () => {
    const filePath = blamePath().trim();
    if (!filePath) return;
    await run('blame', async () => {
      setBlameLines(await gitBlame(props.repoPath, filePath));
    });
  };

  const handleLfsPull = async () => {
    await run('lfs-pull', async () => {
      const result = await lfsPull(props.repoPath);
      setOperationOutput(result.output);
      addToast(result.success ? 'LFS pull completed' : 'LFS pull failed', result.success ? 'success' : 'error');
    });
  };

  const handleLfsTrack = async () => {
    const pattern = lfsPattern().trim();
    if (!pattern) return;
    await run('lfs-track', async () => {
      const result = await lfsTrack(props.repoPath, pattern);
      setOperationOutput(result.output);
      addToast(result.success ? `Tracking ${pattern}` : 'LFS track failed', result.success ? 'success' : 'error');
    });
  };

  const handleLfsUntrack = async () => {
    const pattern = lfsPattern().trim();
    if (!pattern) return;
    await run('lfs-untrack', async () => {
      const result = await lfsUntrack(props.repoPath, pattern);
      setOperationOutput(result.output);
      addToast(result.success ? `Stopped tracking ${pattern}` : 'LFS untrack failed', result.success ? 'success' : 'error');
    });
  };

  const handleSshTest = async () => {
    const host = sshHost().trim();
    if (!host) return;
    await run('ssh-test', async () => {
      const result = await testSshConnection(host, sshKeyPath().trim() || undefined);
      setOperationOutput(result.output);
      addToast(
        result.success ? `SSH connection OK: ${result.host}` : `SSH connection failed: ${result.host}`,
        result.success ? 'success' : 'error',
      );
    });
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        class={`w-[min(860px,92vw)] max-h-[88vh] flex flex-col rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl ${
          phase() === 'enter' ? 'animate-modal-enter' : 'animate-modal-exit'
        }`}
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-bold">Git Tools</h2>
          <button class="text-xs opacity-50 hover:text-red-400 transition-colors" onClick={handleClose}>
            {tt('common.close')}
          </button>
        </div>

        <div class="flex border-b border-white/10 overflow-x-auto shrink-0">
          <For each={tabs}>
            {(tab) => (
              <button
                class={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab() === tab.id
                    ? 'text-cyan-300 border-b-2 border-cyan-300 bg-white/5'
                    : 'text-white/55 hover:text-white'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <Show when={activeTab() === 'tags'}>
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs text-white/55">Manage repository tags.</p>
              <button class={secondaryButtonClass} onClick={loadTags} disabled={busy() === 'tags'}>
                {busy() === 'tags' ? tt('common.loading') : 'Refresh'}
              </button>
            </div>
            <Show
              when={tags().length > 0}
              fallback={<div class="py-8 text-center text-sm text-white/40">No tags found.</div>}
            >
              <div class="space-y-2">
                <For each={tags()}>
                  {(tag) => (
                    <div class="rounded-lg bg-white/5 border border-white/10 p-3 flex items-start gap-3">
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium truncate">{tag.name}</div>
                        <div class="font-mono text-[11px] text-white/40 truncate">{tag.target}</div>
                        <Show when={tag.message}>
                          <div class="mt-1 text-xs text-white/55 line-clamp-2">{tag.message}</div>
                        </Show>
                      </div>
                      <button
                        class={dangerButtonClass}
                        onClick={() => handleDeleteTag(tag.name)}
                        disabled={busy() === `delete-tag-${tag.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={activeTab() === 'submodules'}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                class={inputClass}
                placeholder="Submodule URL"
                value={submoduleUrl()}
                onInput={(e) => setSubmoduleUrl(e.currentTarget.value)}
              />
              <input
                class={inputClass}
                placeholder="Submodule path, e.g. vendor/lib"
                value={submodulePath()}
                onInput={(e) => setSubmodulePath(e.currentTarget.value)}
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class={primaryButtonClass}
                onClick={handleAddSubmodule}
                disabled={busy() === 'submodule-add' || !submoduleUrl().trim() || !submodulePath().trim()}
              >
                Add
              </button>
              <button class={secondaryButtonClass} onClick={handleSubmoduleInit} disabled={busy() === 'submodule-init'}>
                Init
              </button>
              <button class={secondaryButtonClass} onClick={handleSubmoduleUpdate} disabled={busy() === 'submodule-update'}>
                Update Recursive
              </button>
              <button class={secondaryButtonClass} onClick={loadSubmodules} disabled={busy() === 'submodules'}>
                Refresh
              </button>
            </div>
            <Show
              when={submodules().length > 0}
              fallback={<div class="py-8 text-center text-sm text-white/40">No submodules detected.</div>}
            >
              <div class="space-y-1">
                <For each={submodules()}>
                  {(name) => <div class="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-mono">{name}</div>}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={activeTab() === 'blame'}>
            <div class="flex gap-2">
              <input
                class={inputClass}
                placeholder="File path"
                value={blamePath()}
                onInput={(e) => setBlamePath(e.currentTarget.value)}
              />
              <button class={primaryButtonClass} onClick={handleBlame} disabled={busy() === 'blame' || !blamePath().trim()}>
                Load
              </button>
            </div>
            <Show
              when={blameLines().length > 0}
              fallback={<div class="py-8 text-center text-sm text-white/40">Select a tracked file to inspect blame.</div>}
            >
              <div class="max-h-[52vh] overflow-auto rounded-lg border border-white/10 bg-black/15">
                <For each={blameLines()}>
                  {(line) => (
                    <div class="grid grid-cols-[52px_78px_140px_minmax(0,1fr)] gap-2 px-2 py-1 text-[11px] border-b border-white/5">
                      <span class="text-white/35 text-right">{line.lineNumber}</span>
                      <span class="font-mono text-cyan-300/80 truncate" title={line.commitId}>{line.shortId}</span>
                      <span class="text-white/50 truncate" title={line.summary}>{line.author}</span>
                      <span class="font-mono whitespace-pre overflow-hidden text-ellipsis">{line.content || ' '}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={activeTab() === 'reflog'}>
            <div class="flex gap-2">
              <input
                class={inputClass}
                placeholder="Reference, e.g. HEAD or refs/heads/main"
                value={reflogRef()}
                onInput={(e) => setReflogRef(e.currentTarget.value)}
              />
              <button class={primaryButtonClass} onClick={loadReflog} disabled={busy() === 'reflog'}>
                Load
              </button>
            </div>
            <Show
              when={reflogEntries().length > 0}
              fallback={<div class="py-8 text-center text-sm text-white/40">Load a reference to inspect reflog entries.</div>}
            >
              <div class="space-y-2">
                <For each={reflogEntries()}>
                  {(entry) => (
                    <div class="rounded-lg bg-white/5 border border-white/10 p-3 text-xs">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-cyan-300">HEAD@{`{${entry.index}}`}</span>
                        <span class="text-white/55 truncate">{entry.message}</span>
                      </div>
                      <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/40">
                        <span>{entry.committer}</span>
                        <span>{formatReflogTime(entry.timestamp)}</span>
                        <span class="font-mono">{entry.oldId.slice(0, 7)}..{entry.newId.slice(0, 7)}</span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={activeTab() === 'lfs'}>
            <div class="flex gap-2">
              <input
                class={inputClass}
                placeholder="Pattern, e.g. *.psd"
                value={lfsPattern()}
                onInput={(e) => setLfsPattern(e.currentTarget.value)}
              />
              <button class={secondaryButtonClass} onClick={handleLfsPull} disabled={busy() === 'lfs-pull'}>
                Pull
              </button>
              <button class={primaryButtonClass} onClick={handleLfsTrack} disabled={busy() === 'lfs-track' || !lfsPattern().trim()}>
                Track
              </button>
              <button class={dangerButtonClass} onClick={handleLfsUntrack} disabled={busy() === 'lfs-untrack' || !lfsPattern().trim()}>
                Untrack
              </button>
            </div>
            <p class="text-xs text-white/45">LFS operations use the git-lfs CLI when it is installed.</p>
          </Show>

          <Show when={activeTab() === 'ssh'}>
            <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <input
                class={inputClass}
                placeholder="Host"
                value={sshHost()}
                onInput={(e) => setSshHost(e.currentTarget.value)}
              />
              <input
                class={inputClass}
                placeholder="Private key path (optional)"
                value={sshKeyPath()}
                onInput={(e) => setSshKeyPath(e.currentTarget.value)}
              />
              <button class={primaryButtonClass} onClick={handleSshTest} disabled={busy() === 'ssh-test' || !sshHost().trim()}>
                Test
              </button>
            </div>
          </Show>

          <Show when={operationOutput()}>
            <pre class="max-h-48 overflow-auto rounded-lg bg-black/20 border border-white/10 p-3 text-xs whitespace-pre-wrap text-white/70">
              {operationOutput()}
            </pre>
          </Show>

          <Show when={error()}>
            <div class="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error()}</div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default GitToolsPanel;
