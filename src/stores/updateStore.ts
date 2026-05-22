import { createStore } from 'solid-js/store';
import type { GitHubReleaseAsset, UpdateInfo } from '../lib/types';

type DownloadPhase = 'idle' | 'downloading' | 'downloaded' | 'installing';

interface UpdateStore {
  available: boolean;
  tagName: string;
  htmlUrl: string;
  release: UpdateInfo | null;
  asset: GitHubReleaseAsset | null;
  downloadPhase: DownloadPhase;
  bytesDownloaded: number;
  totalBytes: number;
  installerPath: string;
}

const [updateStore, setUpdateStore] = createStore<UpdateStore>({
  available: false,
  tagName: '',
  htmlUrl: '',
  release: null,
  asset: null,
  downloadPhase: 'idle',
  bytesDownloaded: 0,
  totalBytes: 0,
  installerPath: '',
});

export function showUpdate(release: UpdateInfo) {
  setUpdateStore({
    available: true,
    tagName: release.tagName,
    htmlUrl: release.htmlUrl,
    release,
    downloadPhase: 'idle',
  });
}

export function setDownloadAsset(asset: GitHubReleaseAsset) {
  setUpdateStore({ asset, bytesDownloaded: 0, totalBytes: asset.size });
}

export function startDownload() {
  setUpdateStore({ downloadPhase: 'downloading' });
}

export function updateProgress(bytesDownloaded: number, totalBytes: number) {
  setUpdateStore({ bytesDownloaded, totalBytes });
}

export function finishDownload(installerPath: string) {
  setUpdateStore({ downloadPhase: 'downloaded', installerPath });
}

export function startInstall() {
  setUpdateStore({ downloadPhase: 'installing' });
}

export function dismissUpdate() {
  setUpdateStore({
    available: false,
    tagName: '',
    htmlUrl: '',
    release: null,
    asset: null,
    downloadPhase: 'idle',
    bytesDownloaded: 0,
    totalBytes: 0,
    installerPath: '',
  });
}

export { updateStore };
