import { createStore } from 'solid-js/store';

export interface SettingsState {
  defaultDiffView: 'unified' | 'split' | 'fullFile';
  defaultRemoteName: string;
  theme: 'dark' | 'light' | 'system';
  tutorialCompleted: boolean;
  tutorialDismissed: boolean;
}

const STORAGE_KEY = 'vaporgit_settings';

const defaultSettings: SettingsState = {
  defaultDiffView: 'unified',
  defaultRemoteName: 'origin',
  theme: 'system',
  tutorialCompleted: false,
  tutorialDismissed: false,
};

function loadFromStorage(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...defaultSettings };
}

const [settingsStore, setSettingsStore] = createStore<SettingsState>(loadFromStorage());

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsStore));
  } catch {
    // ignore
  }
}

export function updateSettings(partial: Partial<SettingsState>) {
  setSettingsStore(partial);
  saveSettings();
}

export function useSettingsStore() {
  return { settingsStore, setSettingsStore: updateSettings };
}

export function resetTutorial() {
  updateSettings({ tutorialCompleted: false, tutorialDismissed: false });
}

export function dismissTutorial() {
  updateSettings({ tutorialDismissed: true });
}

export function completeTutorial() {
  updateSettings({ tutorialCompleted: true, tutorialDismissed: true });
}

export { settingsStore };
