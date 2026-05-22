import { createStore } from 'solid-js/store';
import type { GitHubUser, GitHubRepo } from '../lib/types';

export interface GitHubState {
  authenticated: boolean;
  user: GitHubUser | null;
  loading: boolean;
  loginPhase: 'idle' | 'authorizing' | 'done' | 'error';
  error: string | null;
  reposCache: GitHubRepo[] | null;
}

const [githubStore, setGithubStore] = createStore<GitHubState>({
  authenticated: false,
  user: null,
  loading: false,
  loginPhase: 'idle',
  error: null,
  reposCache: null,
});

/** Reset login state back to idle (e.g., after error or cancel). */
export function resetLogin() {
  setGithubStore({
    loginPhase: 'idle',
    error: null,
  });
}

/** Set authenticated user and mark as done. */
export function setAuthenticated(user: GitHubUser) {
  setGithubStore({
    authenticated: true,
    user,
    loginPhase: 'done',
    loading: false,
    error: null,
  });
}

/** Cache repo list so it survives route changes. */
export function cacheRepos(repos: GitHubRepo[]) {
  setGithubStore({ reposCache: repos });
}

/** Clear auth state on logout. */
export function clearAuth() {
  setGithubStore({
    authenticated: false,
    user: null,
    loginPhase: 'idle',
    loading: false,
    error: null,
    reposCache: null,
  });
}

export { githubStore, setGithubStore };
