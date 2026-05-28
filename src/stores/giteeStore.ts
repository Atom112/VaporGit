import { createStore } from 'solid-js/store';
import type { GiteeUser, GiteeRepo } from '../lib/types';

export interface GiteeState {
  authenticated: boolean;
  user: GiteeUser | null;
  loading: boolean;
  loginPhase: 'idle' | 'authorizing' | 'done' | 'error';
  error: string | null;
  reposCache: GiteeRepo[] | null;
}

const [giteeStore, setGiteeStore] = createStore<GiteeState>({
  authenticated: false,
  user: null,
  loading: false,
  loginPhase: 'idle',
  error: null,
  reposCache: null,
});

export function resetGiteeLogin() {
  setGiteeStore({ loginPhase: 'idle', error: null });
}

export function setGiteeAuthenticated(user: GiteeUser) {
  setGiteeStore({
    authenticated: true,
    user,
    loginPhase: 'done',
    loading: false,
    error: null,
  });
}

export function cacheGiteeRepos(repos: GiteeRepo[]) {
  setGiteeStore({ reposCache: repos });
}

export function clearGiteeAuth() {
  setGiteeStore({
    authenticated: false,
    user: null,
    loginPhase: 'idle',
    loading: false,
    error: null,
    reposCache: null,
  });
}

export { giteeStore, setGiteeStore };
