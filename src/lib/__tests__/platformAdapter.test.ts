import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === 'github_check_auth') {
      return {
        authenticated: true,
        user: {
          id: 1,
          login: 'octo',
          name: null,
          avatarUrl: 'https://example.com/avatar.png',
          email: null,
        },
      };
    }
    if (command === 'github_list_repos') {
      return [{
        id: 1,
        name: 'repo',
        fullName: 'octo/repo',
        owner: { login: 'octo', id: 1, avatarUrl: 'https://example.com/avatar.png' },
        htmlUrl: 'https://github.com/octo/repo',
        description: null,
        fork: false,
        cloneUrl: 'https://github.com/octo/repo.git',
        sshUrl: 'git@github.com:octo/repo.git',
        language: null,
        stargazersCount: 0,
        forksCount: 0,
        defaultBranch: 'main',
        updatedAt: '2026-01-01T00:00:00Z',
        private: false,
      }];
    }
    if (command === 'github_list_pulls') {
      const repo = {
        id: 1,
        name: 'repo',
        fullName: 'octo/repo',
        owner: { login: 'octo', id: 1, avatarUrl: 'https://example.com/avatar.png' },
        htmlUrl: 'https://github.com/octo/repo',
        cloneUrl: 'https://github.com/octo/repo.git',
        defaultBranch: 'main',
      };
      return [{
        id: 10,
        number: 7,
        title: 'Add platform abstraction',
        body: null,
        state: 'open',
        htmlUrl: 'https://github.com/octo/repo/pull/7',
        diffUrl: 'https://github.com/octo/repo/pull/7.diff',
        head: { label: 'octo:feature', ref: 'feature', sha: 'abc123', repo },
        base: { label: 'octo:main', ref: 'main', sha: 'def456', repo },
        user: { login: 'octo', id: 1, avatarUrl: 'https://example.com/avatar.png' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        closedAt: null,
        mergedAt: null,
        merged: false,
        mergeable: true,
        draft: false,
        additions: 12,
        deletions: 3,
        changedFiles: 2,
      }];
    }
    throw new Error(`unexpected command ${command}`);
  }),
}));

describe('platformAdapter', () => {
  it('parses platform remote URLs', async () => {
    const { parsePlatformRemote } = await import('../platformAdapter');

    expect(parsePlatformRemote('git@github.com:owner/repo.git')).toEqual({
      kind: 'github',
      owner: 'owner',
      repo: 'repo',
    });
    expect(parsePlatformRemote('https://gitee.com/team/project')).toEqual({
      kind: 'gitee',
      owner: 'team',
      repo: 'project',
    });
  });

  it('validates adapter responses at the boundary', async () => {
    const { platformAdapters } = await import('../platformAdapter');

    const auth = await platformAdapters.github.checkAuth();
    const repos = await platformAdapters.github.listRepos();

    expect(auth.authenticated).toBe(true);
    expect(repos[0].fullName).toBe('octo/repo');
  });

  it('validates pull request fields used by platform UI', async () => {
    const { platformAdapters } = await import('../platformAdapter');

    const prs = await platformAdapters.github.listPRs('octo', 'repo', 'open', 1, 30);

    expect(prs[0].head.ref).toBe('feature');
    expect(prs[0].base.ref).toBe('main');
    expect(prs[0].additions).toBe(12);
  });
});
