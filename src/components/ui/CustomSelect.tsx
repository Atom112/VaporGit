import { Component, createSignal, Show, For, onCleanup } from 'solid-js';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  class?: string;
}

const CustomSelect: Component<CustomSelectProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [exitPhase, setExitPhase] = createSignal(false);
  let btnRef: HTMLButtonElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  const selected = () => props.options.find((o) => o.value === props.value);

  const toggle = () => {
    if (open()) {
      close();
    } else {
      setOpen(true);
      setExitPhase(false);
    }
  };

  const close = () => {
    setExitPhase(true);
    setTimeout(() => {
      setOpen(false);
      setExitPhase(false);
    }, 100);
  };

  const select = (value: string) => {
    props.onChange(value);
    close();
  };

  // Close on click outside
  const handleClick = (e: MouseEvent) => {
    if (open() && !btnRef?.contains(e.target as Node) && !panelRef?.contains(e.target as Node)) {
      close();
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', handleClick);
    onCleanup(() => document.removeEventListener('mousedown', handleClick));
  }

  // Close on Escape
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open()) close();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKey);
    onCleanup(() => document.removeEventListener('keydown', handleKey));
  }

  return (
    <div class={`relative ${props.class ?? ''}`}>
      <button
        ref={(el) => { btnRef = el; }}
        type="button"
        onClick={toggle}
        class="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm cursor-pointer hover:bg-white/15 transition-colors"
      >
        <span class="truncate">{selected()?.label ?? ''}</span>
        <svg
          class="w-4 h-4 shrink-0 opacity-50 transition-transform duration-200"
          classList={{ 'rotate-180': open() }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={open()}>
        <div
          ref={(el) => { panelRef = el; }}
          class={`absolute left-0 right-0 z-50 mt-1 py-1 rounded-xl bg-[#5a5a5e] border border-white/15 shadow-2xl text-sm overflow-hidden ${
            exitPhase() ? 'animate-context-menu-exit' : 'animate-context-menu-enter'
          }`}
        >
          <For each={props.options}>
            {(opt) => (
              <button
                type="button"
                onClick={() => select(opt.value)}
                class="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors flex items-center justify-between"
                classList={{
                  'text-cyan-300': opt.value === props.value,
                  'text-white/80': opt.value !== props.value,
                }}
              >
                <span>{opt.label}</span>
                <Show when={opt.value === props.value}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CustomSelect;
