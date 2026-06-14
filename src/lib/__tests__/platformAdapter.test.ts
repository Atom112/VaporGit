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
});
