import { Show } from 'solid-js';
import type { PlatformKind } from '../../lib/platformAdapter';
import { tt } from '../../i18n';

interface PlatformLoginProps {
  kind: PlatformKind;
  phase: 'idle' | 'authorizing' | 'done' | 'error';
  error: string | null;
  onLogin: () => void;
  onRetry: () => void;
}

const platformButtonClass: Record<PlatformKind, string> = {
  github: 'bg-[#24292f] hover:bg-[#2c3138]',
  gitee: 'bg-[#c71d23] hover:bg-[#a8171c]',
};

const PlatformIcon = (props: { kind: PlatformKind }) => (
  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <Show
      when={props.kind === 'github'}
      fallback={
        <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z" />
      }
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </Show>
  </svg>
);

const PlatformLogin = (props: PlatformLoginProps) => (
  <div>
    <Show when={props.phase === 'idle'}>
      <button
        onClick={props.onLogin}
        class={`w-full flex items-center justify-center gap-3 p-3 rounded-xl text-white text-sm font-medium transition-colors ${platformButtonClass[props.kind]}`}
        aria-label={tt(`${props.kind}.login`)}
      >
        <PlatformIcon kind={props.kind} />
        {tt(`${props.kind}.login`)}
      </button>
    </Show>

    <Show when={props.phase === 'authorizing'}>
      <div class="flex items-center gap-2 text-sm text-gray-400" role="status">
        <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        {tt('common.loading')}
      </div>
    </Show>

    <Show when={props.phase === 'error'}>
      <div class="space-y-2">
        <p class="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/30 p-3">
          {props.error}
        </p>
        <button
          onClick={props.onRetry}
          class="p-2 rounded-lg bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-colors"
        >
          {tt('common.refresh')}
        </button>
      </div>
    </Show>
  </div>
);

export default PlatformLogin;
