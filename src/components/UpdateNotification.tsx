import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { listen } from '@tauri-apps/api/event';
import {
  updateStore,
  setDownloadAsset,
  startDownload,
  updateProgress,
  finishDownload,
  startInstall,
  dismissUpdate,
} from '../stores/updateStore';
import { githubGetAsset, githubStartDownload, githubInstallUpdate } from '../lib/tauriCommands';
import type { DownloadProgress } from '../lib/types';

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export default function UpdateNotification() {
  createEffect(() => {
    // Resolve the platform-matching asset from the release reactively
    const release = updateStore.release;
    if (release && !updateStore.asset) {
      githubGetAsset(release).then((asset) => {
        if (asset) setDownloadAsset(asset);
      }).catch(() => {
        // Fallback: user can still click to open the release page
      });
    }
  });

  // Listen for download progress events
  onMount(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      updateProgress(event.payload.bytesDownloaded, event.payload.totalBytes);
    });
    onCleanup(() => unlisten.then((fn) => fn()));
  });

  const handleDownload = async () => {
    if (!updateStore.asset) return;
    startDownload();
    try {
      const path = await githubStartDownload(updateStore.asset);
      finishDownload(path);
    } catch {
      dismissUpdate();
    }
  };

  const handleInstall = async () => {
    if (!updateStore.installerPath) return;
    startInstall();
    try {
      await githubInstallUpdate(updateStore.installerPath);
    } catch {
      dismissUpdate();
    }
  };

  const progressPct = (): number => {
    if (updateStore.totalBytes === 0) return 0;
    return Math.min(100, Math.round((updateStore.bytesDownloaded / updateStore.totalBytes) * 100));
  };

  return (
    <Show when={updateStore.available}>
      <div class="fixed bottom-4 left-4 z-100 max-w-sm animate-toast-in">
        <div class="bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-lg backdrop-blur p-4">
          {/* Title */}
          <p class="text-sm font-medium text-amber-200">
            {updateStore.downloadPhase === 'installing'
              ? '正在安装更新...'
              : `新版本 ${updateStore.tagName} 已发布`}
          </p>
          <p class="text-xs text-amber-300/60 mt-1">
            {updateStore.downloadPhase === 'downloading'
              ? '正在下载更新...'
              : updateStore.downloadPhase === 'downloaded'
                ? '下载完成，点击安装更新'
                : updateStore.downloadPhase === 'installing'
                  ? '安装完成后将自动重启'
                  : '包含新功能与问题修复'}
          </p>

          {/* Progress bar — visible during download */}
          <Show when={updateStore.downloadPhase === 'downloading'}>
            <div class="mt-3 space-y-1">
              <div class="w-full h-2 rounded-full bg-amber-500/20 overflow-hidden">
                <div
                  class="h-full rounded-full bg-amber-400 transition-all duration-300 ease-out"
                  style={{ width: `${progressPct()}%` }}
                />
              </div>
              <p class="text-xs text-amber-300/50 text-right">
                {formatSize(updateStore.bytesDownloaded)} / {formatSize(updateStore.totalBytes)}
              </p>
            </div>
          </Show>

          {/* Action buttons */}
          <Show when={updateStore.downloadPhase === 'idle' && updateStore.asset}>
            <div class="flex gap-2 mt-3">
              <button
                onClick={handleDownload}
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
          </Show>

          <Show when={updateStore.downloadPhase === 'downloaded'}>
            <div class="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
              >
                安装更新
              </button>
              <button
                onClick={dismissUpdate}
                class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300/50 hover:text-amber-300/80 hover:bg-white/5 transition-colors"
              >
                稍后
              </button>
            </div>
          </Show>

          {/* Installing spinner */}
          <Show when={updateStore.downloadPhase === 'installing'}>
            <div class="flex items-center gap-2 mt-3 text-xs text-amber-300/60">
              <div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              正在安装...
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
