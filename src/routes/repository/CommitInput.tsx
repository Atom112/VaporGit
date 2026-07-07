import { Show } from 'solid-js';
import { tt } from '../../i18n';

interface CommitInputProps {
  message: string;
  amendMode: boolean;
  stagedCount: number;
  error: string | null;
  onMessageChange: (message: string) => void;
  onAmendModeChange: (enabled: boolean) => void;
  onCommit: () => void;
}

const CommitInput = (props: CommitInputProps) => (
  <div id="commit-area" class="p-3 border-b border-white/10 shrink-0">
    <textarea
      class="w-full p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm resize-none focus:outline-none focus:border-cyan-400/50 placeholder-white/30"
      rows={3}
      placeholder={tt('repo.commitPlaceholder')}
      value={props.message}
      onInput={(e) => props.onMessageChange(e.currentTarget.value)}
    />
    <div class="flex gap-2 mt-2 items-center">
      <label class="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 cursor-pointer select-none">
        <input
          type="checkbox"
          class="sr-only"
          checked={props.amendMode}
          onChange={(e) => props.onAmendModeChange(e.currentTarget.checked)}
        />
        <span class={`w-3.5 h-3.5 rounded border ${props.amendMode ? 'bg-cyan-500/40 border-cyan-400/60' : 'border-white/30'} flex items-center justify-center transition-colors`} aria-hidden="true">
          {props.amendMode && (
            <svg class="w-2.5 h-2.5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span>{tt('repo.amend')}</span>
        <span class="text-white/30">({tt('repo.amendDesc')})</span>
      </label>
      <button
        class="flex-1 py-1.5 px-3 rounded-lg bg-cyan-500/30 hover:bg-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        onClick={props.onCommit}
        disabled={!props.message.trim() || props.stagedCount === 0}
      >
        {props.amendMode ? tt('repo.amend') : tt('repo.commit')}
      </button>
    </div>
    <Show when={props.error}>
      <div class="mt-2 text-xs text-red-400">{props.error}</div>
    </Show>
  </div>
);

export default CommitInput;
