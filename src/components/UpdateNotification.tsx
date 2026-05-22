import { Show } from 'solid-js';
import { openUrl } from '@tauri-apps/plugin-opener';
import { updateStore, dismissUpdate } from '../stores/updateStore';

export default function UpdateNotification() {
  return (
    <Show when={updateStore.available}>
      <div class="fixed bottom-4 left-4 z-[100] max-w-sm animate-toast-in">
        <div class="bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-lg backdrop-blur p-4">
          <p class="text-sm font-medium text-amber-200">
            新版本 {updateStore.tagName} 已发布
          </p>
          <p class="text-xs text-amber-300/60 mt-1">包含新功能与问题修复</p>
          <div class="flex gap-2 mt-3">
            <button
              onClick={() => openUrl(updateStore.htmlUrl)}
              class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              确认下载
            </button>
            <button
              onClick={dismissUpdate}
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300/50 hover:text-amber-300/80 hover:bg-white/5 transition-colors"
            >
              忽略
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
