import { For } from 'solid-js';
import { toasts, removeToast } from '../stores/toastStore';

export default function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <For each={toasts.items}>
        {(toast) => (
          <div
            class={`px-4 py-3 rounded-xl shadow-lg backdrop-blur border text-sm font-medium animate-toast-in cursor-pointer ${
              toast.type === 'success'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'bg-red-500/20 border-red-500/40 text-red-200'
            }`}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );
}
