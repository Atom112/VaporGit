import * as v from 'valibot';
import {
  githubCheckAuth,
  githubCreatePull,
  githubGetPull,
  githubGetUser,
  githubListPulls,
  githubListRepos,
  githubLogin,
  githubLogout,
  githubMergePull,
  giteeCheckAuth,
  giteeCreatePull,
  giteeGetPull,
  giteeGetUser,
  giteeListPulls,
  giteeListRepos,
  giteeLogin,
  giteeLogout,
  giteeMergePull,
} from './tauriCommands';
import type {
  AuthStatus,
  CreatePullRequest,
  GitHubPullRequest,
  GitHubRepo,
  GitHubUser,
  GiteeAuthStatus,
  GiteePullRequest,
  GiteeRepo,
  GiteeUser,
  MergePullRequest,
} from './types';

export type PlatformKind = 'github' | 'gitee';
export type PlatformUser = GitHubUser | GiteeUser;
export type PlatformRepo = GitHubRepo | GiteeRepo;
export type PlatformPullRequest = GitHubPullRequest | GiteePullRequest;
export type PlatformAuthStatus = AuthStatus | GiteeAuthStatus;

export interface PlatformAdapter {
  kind: PlatformKind;
  label: string;
  login(): Promise<PlatformUser>;
  checkAuth(): Promise<PlatformAuthStatus>;
  logout(): Promise<void>;
  listRepos(page?: number, perPage?: number): Promise<PlatformRepo[]>;
  listPRs(owner: string, repo: string, state?: string, page?: number, perPage?: number): Promise<PlatformPullRequest[]>;
  getPR(owner: string, repo: string, number: number): Promise<PlatformPullRequest>;
  createPR(owner: string, repo: string, request: CreatePullRequest): Promise<PlatformPullRequest>;
  mergePR(owner: string, repo: string, number: number, request: MergePullRequest): Promise<{ merged: boolean; message: string; sha: string | null }>;
  getUser(): Promise<PlatformUser>;
}

const OwnerSchema = v.object({
  login: v.string(),
  id: v.number(),
  avatarUrl: v.string(),
});

const UserSchema = v.object({
  id: v.number(),
  login: v.string(),
  name: v.nullable(v.string()),
  avatarUrl: v.string(),
  email: v.nullable(v.string()),
});

const RepoSchema = v.object({
  id: v.number(),
  name: v.string(),
  fullName: v.string(),
  owner: OwnerSchema,
  htmlUrl: v.string(),
  description: v.nullable(v.string()),
  fork: v.boolean(),
  cloneUrl: v.string(),
  language: v.nullable(v.string()),
  stargazersCount: v.number(),
  forksCount: v.number(),
  defaultBranch: v.string(),
  updatedAt: v.string(),
  private: v.boolean(),
});

const PullRequestSchema = v.object({
  id: v.number(),
  number: v.number(),
  title: v.string(),
  body: v.nullable(v.string()),
  state: v.string(),
  htmlUrl: v.string(),
  diffUrl: v.string(),
  user: OwnerSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
  closedAt: v.nullable(v.string()),
  mergedAt: v.nullable(v.string()),
  merged: v.boolean(),
  mergeable: v.nullable(v.boolean()),
  draft: v.boolean(),
});

const AuthStatusSchema = v.object({
  authenticated: v.boolean(),
  user: v.nullable(UserSchema),
});

function parseWithBoundary<T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>, value: unknown, label: string): T {
  try {
    return v.parse(schema, value);
  } catch (e) {
    console.error(`${label} 响应校验失败:`, e);
    throw new Error(`${label} 响应格式异常`);
  }
}

function parseUser<T extends PlatformUser>(value: unknown, label: string): T {
  return parseWithBoundary(UserSchema, value, label) as T;
}

function parseAuth<T extends PlatformAuthStatus>(value: unknown, label: string): T {
  return parseWithBoundary(AuthStatusSchema, value, label) as T;
}

function parseRepos<T extends PlatformRepo>(value: unknown, label: string): T[] {
  return parseWithBoundary(v.array(RepoSchema), value, label) as T[];
}

function parsePR<T extends PlatformPullRequest>(value: unknown, label: string): T {
  return parseWithBoundary(PullRequestSchema, value, label) as T;
}

function parsePRs<T extends PlatformPullRequest>(value: unknown, label: string): T[] {
  return parseWithBoundary(v.array(PullRequestSchema), value, label) as T[];
}

export const platformAdapters: Record<PlatformKind, PlatformAdapter> = {
  github: {
    kind: 'github',
    label: 'GitHub',
    async login() {
      return parseUser<GitHubUser>(await githubLogin(), 'GitHub 登录');
    },
    async checkAuth() {
      return parseAuth<AuthStatus>(await githubCheckAuth(), 'GitHub 鉴权');
    },
    async logout() {
      await githubLogout();
    },
    async listRepos(page, perPage) {
      return parseRepos<GitHubRepo>(await githubListRepos(page, perPage), 'GitHub 仓库列表');
    },
    async listPRs(owner, repo, state, page, perPage) {
      return parsePRs<GitHubPullRequest>(
        await githubListPulls(owner, repo, state, page, perPage),
        'GitHub PR 列表',
      );
    },
    async getPR(owner, repo, number) {
      return parsePR<GitHubPullRequest>(await githubGetPull(owner, repo, number), 'GitHub PR 详情');
    },
    async createPR(owner, repo, request) {
      return parsePR<GitHubPullRequest>(await githubCreatePull(owner, repo, request), 'GitHub 创建 PR');
    },
    async mergePR(owner, repo, number, request) {
      return githubMergePull(owner, repo, number, request);
    },
    async getUser() {
      return parseUser<GitHubUser>(await githubGetUser(), 'GitHub 用户');
    },
  },
  gitee: {
    kind: 'gitee',
    label: 'Gitee',
    async login() {
      return parseUser<GiteeUser>(await giteeLogin(), 'Gitee 登录');
    },
    async checkAuth() {
      return parseAuth<GiteeAuthStatus>(await giteeCheckAuth(), 'Gitee 鉴权');
    },
    async logout() {
      await giteeLogout();
    },
    async listRepos(page, perPage) {
      return parseRepos<GiteeRepo>(await giteeListRepos(page, perPage), 'Gitee 仓库列表');
    },
    async listPRs(owner, repo, state, page, perPage) {
      return parsePRs<GiteePullRequest>(
        await giteeListPulls(owner, repo, state, page, perPage),
        'Gitee PR 列表',
      );
    },
    async getPR(owner, repo, number) {
      return parsePR<GiteePullRequest>(await giteeGetPull(owner, repo, number), 'Gitee PR 详情');
    },
    async createPR(owner, repo, request) {
      return parsePR<GiteePullRequest>(await giteeCreatePull(owner, repo, request), 'Gitee 创建 PR');
    },
    async mergePR(owner, repo, number, request) {
      return giteeMergePull(owner, repo, number, request);
    },
    async getUser() {
      return parseUser<GiteeUser>(await giteeGetUser(), 'Gitee 用户');
    },
  },
};

export function getPlatformAdapter(kind: PlatformKind): PlatformAdapter {
  return platformAdapters[kind];
}

export function parsePlatformRemote(url: string): { kind: PlatformKind; owner: string; repo: string } | null {
  const match = url.match(/(?:github|gitee)\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) return null;
  const kind: PlatformKind = url.includes('gitee.com') ? 'gitee' : 'github';
  return {
    kind,
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}
