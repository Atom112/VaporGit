import { describe, expect, it } from 'vitest';
import { repoStore, setRepoStore } from '../repoStore';

describe('repoStore', () => {
  it('tracks repository path and loading state', () => {
    setRepoStore({
      repoPath: 'C:/repo',
      repoInfo: null,
      loading: true,
      error: null,
    });

    expect(repoStore.repoPath).toBe('C:/repo');
    expect(repoStore.loading).toBe(true);

    setRepoStore({
      repoPath: null,
      repoInfo: null,
      loading: false,
      error: null,
    });
  });
});
