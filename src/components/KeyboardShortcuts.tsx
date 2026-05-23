import { onMount, onCleanup, createSignal, Show, For } from 'solid-js';

interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: string;
}

interface KeyboardShortcutsProps {
  onFetch?: () => void;
  onPull?: () => void;
  onPush?: () => void;
  onCommit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onStash?: () => void;
  onRebase?: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onBranchTab?: () => void;
  disabled?: boolean;
}

export default function KeyboardShortcuts(props: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = createSignal(false);

  const shortcuts: ShortcutDef[] = [
    { key: 'f', ctrl: true, shift: true, description: 'Fetch', action: 'Fetch 远程更新' },
    { key: 'l', ctrl: true, shift: true, description: 'Pull', action: '拉取远程更新' },
    { key: 'p', ctrl: true, shift: true, description: 'Push', action: '推送本地提交' },
    { key: 'Enter', ctrl: true, description: 'Commit', action: '提交暂存文件' },
    { key: 'z', ctrl: true, description: 'Undo', action: '撤销上次提交' },
    { key: 'y', ctrl: true, description: 'Redo', action: '重做撤销' },
    { key: 's', ctrl: true, shift: true, description: 'Stash', action: '暂存工作区' },
    { key: 'b', ctrl: true, shift: true, description: 'Branch', action: '切换分支视图' },
    { key: 'r', ctrl: true, shift: true, description: 'Rebase', action: 'Rebase 操作' },
    { key: 'a', ctrl: true, shift: true, description: 'Stage All', action: '暂存所有文件' },
    { key: 'u', ctrl: true, shift: true, description: 'Unstage All', action: '取消暂存所有' },
    { key: 'r', ctrl: true, description: 'Refresh', action: '刷新所有数据' },
    { key: 'Escape', description: 'Back', action: '返回 / 关闭面板' },
    { key: '/', ctrl: true, description: 'Help', action: '显示快捷键帮助' },
  ];

  const isInputFocused = () => {
    const active = document.activeElement;
    return active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.tagName === 'SELECT');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;

    const ctrl = e.ctrlKey || e.metaKey;

    // Help dialog — always available
    if (e.key === '?' && !ctrl) {
      e.preventDefault();
      setShowHelp(true);
      return;
    }
    if (ctrl && e.key === '/') {
      e.preventDefault();
      setShowHelp(true);
      return;
    }

    // When typing in input fields, only allow Ctrl+Enter for commit
    if (isInputFocused()) {
      if (ctrl && e.key === 'Enter') {
        e.preventDefault();
        props.onCommit?.();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (showHelp()) {
        setShowHelp(false);
        return;
      }
      props.onBack?.();
      return;
    }

    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); props.onFetch?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); props.onPull?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); props.onPush?.(); }
    else if (ctrl && e.key === 'Enter') { e.preventDefault(); props.onCommit?.(); }
    else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); props.onUndo?.(); }
    else if (ctrl && (e.key.toLowerCase() === 'y')) { e.preventDefault(); props.onRedo?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); props.onStash?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); props.onBranchTab?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); props.onRebase?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); props.onStageAll?.(); }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'u') { e.preventDefault(); props.onUnstageAll?.(); }
    else if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); props.onRefresh?.(); }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={showHelp()}>
      <div
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={() => setShowHelp(false)}
      >
        <div
          class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 class="text-base font-bold">键盘快捷键</h2>
            <button
              class="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setShowHelp(false)}
            >
              关闭
            </button>
          </div>
          <div class="p-5 space-y-2">
            <For each={shortcuts}>
              {(s) => (
                <div class="flex items-center justify-between text-sm">
                  <span class="opacity-70">{s.action}</span>
                  <kbd class="px-2 py-0.5 rounded bg-white/10 text-xs font-mono text-cyan-300 whitespace-nowrap ml-4">
                    {s.ctrl && 'Ctrl+'}{s.shift && 'Shift+'}{s.key === 'Enter' ? 'Enter' : s.key === 'Escape' ? 'Esc' : s.key}
                  </kbd>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
