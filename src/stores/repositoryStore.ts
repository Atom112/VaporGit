import { createStore } from 'solid-js/store';

export type RepositoryLeftTab = 'graph' | 'branches';
export type RepositoryLeftMode = 'tree' | 'detail' | 'diff';
export type RepositoryModalKey =
  | 'stash'
  | 'conflictResolver'
  | 'rebase'
  | 'merge'
  | 'remoteManager'
  | 'branchCompare'
  | 'push';
export type RepositoryLoadingKey = 'remoteAction' | 'undo' | 'commit' | 'search' | 'graphMore';

export interface RepositoryPanelState {
  leftTab: RepositoryLeftTab;
  leftMode: RepositoryLeftMode;
  rightWidth: number;
}

export interface RepositoryModalState {
  stash: boolean;
  conflictResolver: boolean;
  rebase: boolean;
  merge: boolean;
  remoteManager: boolean;
  branchCompare: boolean;
  push: boolean;
}

export interface RepositoryLoadingState {
  remoteAction: boolean;
  undo: boolean;
  commit: boolean;
  search: boolean;
  graphMore: boolean;
}

export interface RepositoryState {
  panels: RepositoryPanelState;
  modals: RepositoryModalState;
  loading: RepositoryLoadingState;
}

const defaultRepositoryState: RepositoryState = {
  panels: {
    leftTab: 'graph',
    leftMode: 'tree',
    rightWidth: 420,
  },
  modals: {
    stash: false,
    conflictResolver: false,
    rebase: false,
    merge: false,
    remoteManager: false,
    branchCompare: false,
    push: false,
  },
  loading: {
    remoteAction: false,
    undo: false,
    commit: false,
    search: false,
    graphMore: false,
  },
};

const [repositoryStore, setRepositoryStore] = createStore<RepositoryState>(defaultRepositoryState);

export function setRepositoryLeftTab(leftTab: RepositoryLeftTab) {
  setRepositoryStore('panels', 'leftTab', leftTab);
}

export function setRepositoryLeftMode(leftMode: RepositoryLeftMode) {
  setRepositoryStore('panels', 'leftMode', leftMode);
}

export function setRepositoryRightWidth(width: number) {
  setRepositoryStore('panels', 'rightWidth', Math.max(180, Math.min(500, width)));
}

export function setRepositoryModal(key: RepositoryModalKey, open: boolean) {
  setRepositoryStore('modals', key, open);
}

export function setRepositoryLoading(key: RepositoryLoadingKey, loading: boolean) {
  setRepositoryStore('loading', key, loading);
}

export function resetRepositoryViewState() {
  setRepositoryStore(defaultRepositoryState);
}

export function useRepositoryStore() {
  return {
    repositoryStore,
    setRepositoryStore,
    setRepositoryLeftTab,
    setRepositoryLeftMode,
    setRepositoryRightWidth,
    setRepositoryModal,
    setRepositoryLoading,
    resetRepositoryViewState,
  };
}

export { repositoryStore, setRepositoryStore };
