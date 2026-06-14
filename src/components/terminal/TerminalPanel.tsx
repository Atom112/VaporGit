import { Component, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { resizeTerminal, writeTerminal, closeTerminal } from '../../lib/tauriCommands';
import { listen } from '@tauri-apps/api/event';
import { tt } from '../../i18n';
import { describeError } from '../../lib/gitErrorDesc';

interface TerminalPanelProps {
  phase: 'enter' | 'exit' | null;
  onClose: () => void;
}

const TerminalPanel: Component<TerminalPanelProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [fitAddon] = createSignal<FitAddon>(new FitAddon());
  const [terminal] = createSignal<Terminal>(new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 13,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    allowTransparency: true,
    theme: {
      background: 'rgba(30, 30, 46, 0.3)',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#585b70',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
  }));

  const logTerminalError = (context: string, error: unknown) => {
    console.warn(`${context}: ${describeError(error)}`);
  };

  const fitSafely = (fit: FitAddon) => {
    try {
      fit.fit();
    } catch (e) {
      logTerminalError('Terminal fit failed', e);
    }
  };

  onMount(() => {
    const term = terminal();
    const fit = fitAddon();
    term.loadAddon(fit);
    if (!containerRef) return;
    term.open(containerRef);

    // Fit after open (may report 0 cols/rows if hidden; re-fit after animation)
    requestAnimationFrame(() => {
      fitSafely(fit);
    });

    // Listen for terminal data from backend
    const cleanupFns: (() => void)[] = [];

    listen<number[]>('terminal-output', (event) => {
      term.write(new Uint8Array(event.payload));
    }).then((fn) => cleanupFns.push(fn));

    listen('terminal-exited', () => {
      term.write('\r\n\x1b[31m[进程已退出]\x1b[0m\r\n');
    }).then((fn) => cleanupFns.push(fn));

    // Forward user input to backend
    term.onData((data) => {
      writeTerminal(data).catch((e) => logTerminalError('Terminal write failed', e));
    });

    // Forward resize events to backend
    term.onResize(({ cols, rows }) => {
      resizeTerminal(cols, rows).catch((e) => logTerminalError('Terminal resize failed', e));
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      fitSafely(fit);
    });
    ro.observe(containerRef);

    onCleanup(() => {
      ro.disconnect();
      cleanupFns.forEach((fn) => fn());
      term.dispose();
      // Kill the backend process when component unmounts (e.g. navigating away)
      closeTerminal().catch((e) => logTerminalError('Terminal close failed', e));
    });
  });

  // Re-fit after enter animation completes
  createEffect(() => {
    if (props.phase === 'enter') {
      setTimeout(() => {
        fitSafely(fitAddon());
      }, 250);
    }
  });

  return (
    <div
      class={`shrink-0 border-t border-white/10 overflow-hidden flex flex-col ${
        props.phase === 'enter' ? 'animate-terminal-enter' :
        props.phase === 'exit' ? 'animate-terminal-exit' : ''
      }`}
      style={{
        height: props.phase === null ? '0px' : '240px',
        ...(props.phase === null ? {
          opacity: 0,
          transform: 'translateY(100%)',
        } : {}),
        background: 'rgba(30, 30, 46, 0.18)',
        'backdrop-filter': 'blur(24px)',
        '-webkit-backdrop-filter': 'blur(24px)',
      }}
    >
      {/* Subtle gradient overlay for acrylic depth */}
      <div
        class="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(120, 113, 255, 0.06) 0%, rgba(236, 72, 153, 0.04) 100%)',
        }}
      />
      {/* Header */}
      <div class="relative flex items-center justify-between px-3 py-1.5 bg-white/[0.04] shrink-0">
        <span class="text-xs font-medium opacity-60">{tt('repo.terminal')}</span>
        <button
          class="text-xs opacity-40 hover:text-red-400 hover:opacity-100 transition-colors"
          onClick={props.onClose}
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Terminal container */}
      <div ref={(el) => { containerRef = el; }} class="relative flex-1 min-h-0" />
      <style>{`
        .xterm {
          height: 100%;
        }
        .xterm .xterm-viewport {
          background-color: rgba(30, 30, 46, 0.3) !important;
          overflow-x: hidden !important;
          padding: 0 !important;
        }
        .xterm .xterm-scrollable-element {
          margin: 0 !important;
          padding: 0 !important;
          top: 0 !important;
          min-height: 100% !important;
        }
        .xterm .xterm-screen {
          padding: 0 !important;
          margin: 0 !important;
        }
        .xterm .composition-view {
          background: transparent !important;
        }
        .xterm-viewport::-webkit-scrollbar {
          width: 8px;
        }
        .xterm-viewport::-webkit-scrollbar-track {
          background: transparent;
        }
        .xterm-viewport::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .xterm-viewport::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.22);
          background-clip: padding-box;
        }
        .xterm-viewport::-webkit-scrollbar-thumb:active {
          background: rgba(255, 255, 255, 0.3);
          background-clip: padding-box;
        }
      `}</style>
    </div>
  );
};

export default TerminalPanel;
