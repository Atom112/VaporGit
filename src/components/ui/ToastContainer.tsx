import { For } from 'solid-js';
import { toasts, markExiting } from '../../stores/toastStore';

export default function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <For each={toasts.items}>
        {(toast) => (
          <div
            class={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium cursor-pointer bg-[#3a3a3e]/90 ${
              toast.exiting ? 'animate-toast-out' : 'animate-toast-in'
            } ${
              toast.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-500/20 border-red-500/40 text-red-200'
                : 'bg-sky-500/20 border-sky-500/40 text-sky-200'
            }`}
            onClick={() => {
              if (!toast.exiting) markExiting(toast.id);
            }}
          >
            <div>{toast.message}</div>
            {toast.type === 'error' && toast.detail && (
              <div class="text-xs opacity-60 mt-1 leading-relaxed break-all">{toast.detail}</div>
            )}
          </div>
        )}
      </For>
    </div>
  );
}
