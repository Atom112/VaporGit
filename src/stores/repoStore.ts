import { createStore } from 'solid-js/store';
import type { RepoInfo } from '../lib/types';

export interface RepoState {
  repoPath: string | null;
  repoInfo: RepoInfo | null;
  loading: boolean;
  error: string | null;
}

const [repoStore, setRepoStore] = createStore<RepoState>({
  repoPath: null,
  repoInfo: null,
  loading: false,
  error: null,
});

export function useRepoStore() {
  return { repoStore, setRepoStore };
}

export { repoStore, setRepoStore };