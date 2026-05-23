# VaporGit 详细开发计划

## 项目现状

VaporGit 当前处于 **v1.0.2 阶段**，已完成 M1~M3：

- M1：本地 Git 基础操作（打开仓库、暂存/提交、Diff 查看、提交历史）
- M2：DAG 提交树可视化、分支管理（创建/切换/删除）
- M3：远程同步（Fetch/Pull/Push）、冲突处理、Stash、Rebase、Cherry-pick

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                  前端 (SolidJS)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  路由层    │ │  状态管理  │ │   组件层          │ │
│  │ @solidjs  │ │ createStore │ │ 仓库栏/提交树/Diff│ │
│  │ /router   │ │ 按域拆分    │ │   设置面板/弹窗    │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
├──────────────────────┬──────────────────────────┤
│    Tauri Commands     │     Tauri Events         │
│    (invoke 调用)       │     (事件推送)            │
├──────────────────────┴──────────────────────────┤
│                  后端 (Rust)                      │
│  ┌──────────────────────────────────────────────┐│
│  │              Git 服务层 (git2)                 ││
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────┐ ││
│  │  │ 仓库  │ │ 提交  │ │ 分支  │ │ Diff/文件状态 │ ││
│  │  │ 管理  │ │ 历史  │ │ 管理  │ │              │ ││
│  │  └──────┘ └──────┘ └──────┘ └──────────────┘ ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 技术选型决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Git 后端库 | `git2` (libgit2 绑定) | 原生性能，无 CLI 解析开销，跨平台一致 |
| 提交树渲染 | Canvas | 大仓库（万级提交）性能优于 DOM/SVG |
| 前端状态管理 | SolidJS `createStore` + Context | 轻量，无额外依赖，与框架深度集成 |
| Diff 视图 | 自研组件 | 可控性高，支持 side-by-side 和 unified 双模式 |
| 大文件处理 | 流式读取 + 虚拟滚动 | 避免内存暴涨 |
| GitHub OAuth | Device Authorization Flow | 桌面端最佳实践，无需本地服务器 |
| 令牌存储 | OS 密钥链 (keyring crate) | 安全持久化，跨平台 |
| GitHub API | REST (优先) + GraphQL (按需) | REST 简单直接，GraphQL 用于复杂 PR 查询 |

### 目录结构规划

```
src/
├── components/
│   ├── Navbar.tsx              # [已有] 导航栏
│   ├── Titlebar.tsx            # [已有] 自定义标题栏
│   ├── RepoSelector.tsx        # [已有] 仓库选择器/最近列表
│   ├── StatusBar.tsx           # [已有] 底部状态栏
│   ├── CommitGraph.tsx         # [已有] DAG 提交树 (Canvas)
│   ├── DiffView.tsx            # [已有] 文件差异视图
│   ├── FileList.tsx            # [已有] 工作区文件列表
│   ├── BranchList.tsx          # [已有] 分支列表
│   ├── CommitDetail.tsx        # [已有] 提交详情面板
│   ├── StashPanel.tsx          # [已有] Stash 管理
│   ├── ConflictResolver.tsx    # [已有] 冲突解决
│   ├── InteractiveRebase.tsx   # [已有] Rebase/Cherry-pick
│   ├── GitHubLogin.tsx         # [新建] GitHub SSO 登录
│   ├── GitHubUserMenu.tsx      # [新建] 用户头像菜单
│   ├── GitHubRepoList.tsx      # [新建] 仓库列表
│   ├── PRList.tsx              # [新建] PR 列表
│   ├── PRDetail.tsx            # [新建] PR 详情
│   └── PRCreateDialog.tsx      # [新建] 创建 PR 弹窗
├── routes/
│   ├── Home.tsx                # [已有] 主页/仓库打开
│   ├── Repository.tsx          # [已有] 仓库主工作区
│   ├── Settings.tsx            # [已有] 设置页
│   └── GitHubPRs.tsx           # [新建] PR 路由页
├── stores/
│   ├── repoStore.ts            # [已有] 仓库状态
│   ├── commitStore.ts          # [已有] 提交历史/图数据
│   ├── diffStore.ts            # [已有] Diff 数据
│   ├── settingsStore.ts        # [已有] 用户设置
│   ├── toastStore.ts           # [已有] Toast 通知
│   └── githubStore.ts          # [新建] GitHub 认证/仓库/PR 状态
├── lib/
│   ├── tauriCommands.ts        # [已有] Tauri invoke 封装
│   ├── types.ts                # [已有] 共享类型定义
│   ├── syntax.ts               # [已有] 语法高亮
│   └── diffParser.ts           # [新建] GitHub patch -> DiffResult 转换
├── App.tsx                     # [已有] 根布局
├── App.css                     # [已有] 全局样式
└── index.tsx                   # [已有] 入口

src-tauri/src/
├── main.rs                     # [已有] 入口
├── lib.rs                      # [已有] Tauri Builder + 命令注册
├── commands/
│   ├── mod.rs
│   ├── repo.rs                 # [已有] 仓库管理命令
│   ├── commit.rs               # [已有] 提交/历史命令
│   ├── branch.rs               # [已有] 分支操作命令
│   ├── diff.rs                 # [已有] Diff 文件命令
│   ├── remote.rs               # [已有] 远程操作命令
│   ├── stash.rs                # [已有] Stash 命令
│   └── github.rs               # [新建] GitHub 相关命令
├── git/
│   ├── mod.rs
│   ├── repo.rs                 # [已有] git2::Repository 封装
│   ├── commit.rs               # [已有] 提交查询与操作
│   ├── branch.rs               # [已有] 分支管理
│   ├── diff.rs                 # [已有] Diff 生成
│   ├── status.rs               # [已有] 工作区状态
│   ├── remote.rs               # [已有] Fetch/Pull/Push
│   └── stash.rs                # [已有] Stash 操作
├── github/
│   ├── mod.rs                  # [新建] 模块导出
│   ├── auth.rs                 # [新建] OAuth Device Flow 认证
│   ├── api.rs                  # [新建] GitHub REST API 客户端
│   ├── repos.rs                # [新建] 仓库列表/搜索
│   └── pulls.rs                # [新建] PR 操作
└── models/
    ├── mod.rs
    ├── commit.rs               # [已有] 提交元数据模型
    ├── branch.rs               # [已有] 分支模型
    ├── diff.rs                 # [已有] Diff 模型
    ├── status.rs               # [已有] 文件状态模型
    ├── conflict.rs             # [已有] 冲突模型
    ├── remote.rs               # [已有] 远程模型
    ├── stash.rs                # [已有] Stash 模型
    └── github.rs               # [新建] GitHub 用户/仓库/PR 模型
```

---

## 里程碑与迭代计划

### M1：可用的基础版（已完成）

- 打开本地 Git 仓库并显示文件状态
- 暂存/取消暂存文件
- 创建提交
- 查看文件 Diff（Unified 模式）
- 浏览提交历史列表

---

### M2：图形增强版（已完成）

- DAG 提交树正确渲染，颜色区分分支
- 节点悬停显示提交信息
- 点击节点联动右侧 Diff
- 分支创建/切换/删除功能正常
- Side-by-side 与 Unified 模式可切换

---

### M3：进阶协作版（已完成）

- Fetch/Pull/Push 操作正常
- 冲突可检测并逐步解决
- Stash 保存/应用/弹出/列表功能正常
- Cherry-pick 和 Rebase 有可视化引导

---

### M4：GitHub 集成（当前阶段）

接入 GitHub SSO 认证，允许用户操作其 GitHub 账号下的所有仓库，完善 Pull Request 工作流。

因范围较大，拆分为三个子阶段：

---

#### M4-A：GitHub SSO 认证

**目标**：用户可通过 GitHub 登录，令牌跨重启持久化，应用内显示用户信息。

**新增 Rust 依赖**：`reqwest`、`keyring`、`url`

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| A.1 | 添加 Rust 依赖 | `Cargo.toml` | reqwest (json+rustls-tls), keyring, url |
| A.2 | 定义 GitHub 数据模型 | `models/github.rs` | GitHubUser, DeviceFlowResponse, AuthStatus 等 |
| A.3 | 实现 OAuth Device Flow | `github/auth.rs` | start_device_flow / poll_for_token / save_token / load_token / clear_token |
| A.4 | 实现 GitHub API 客户端 | `github/api.rs` | GitHubClient struct，封装 GET/POST，处理认证头和限流 |
| A.5 | 实现认证相关 Tauri 命令 | `commands/github.rs` | github_start_login, github_poll_login, github_check_auth, github_logout, github_get_user |
| A.6 | 注册新模块和命令 | `lib.rs`, `models/mod.rs`, `commands/mod.rs` | 注册 github 模块和所有新命令 |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| A.7 | 定义 TS 类型 | `lib/types.ts` | GitHubUser, DeviceFlowResponse, AuthStatus |
| A.8 | 封装 invoke 调用 | `lib/tauriCommands.ts` | 所有 github_* 命令的 TS 封装 |
| A.9 | 实现 githubStore | `stores/githubStore.ts` | 认证状态、用户信息、loading/error 状态 |
| A.10 | 实现 GitHubLogin 组件 | `components/GitHubLogin.tsx` | 设备码展示 + "打开浏览器" + 轮询等待 |
| A.11 | 实现 GitHubUserMenu 组件 | `components/GitHubUserMenu.tsx` | 头像 + 下拉菜单（登录名/退出） |
| A.12 | 修改 Navbar | `components/Navbar.tsx` | 右侧显示 GitHub 状态（头像/登录按钮） |
| A.13 | 修改 Settings 页 | `routes/Settings.tsx` | 添加"GitHub 账户"区块 |

**M4-A 验收标准**：

- 首次使用点击"Login with GitHub"，显示设备码和验证 URL
- 点击"Open Browser"打开 GitHub 授权页
- 用户在 GitHub 授权后，应用自动检测并显示用户信息
- 关闭重开应用后认证状态保持（令牌持久化在密钥链）
- 退出登录清除令牌，回到未认证状态

---

#### M4-B：GitHub 仓库管理

**目标**：列出用户所有仓库，支持搜索/筛选，一键克隆并自动配置远程。

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| B.1 | 实现仓库列表 API | `github/repos.rs` | list_user_repos (分页), get_repo, URL 格式检测 |
| B.2 | 添加仓库相关命令 | `commands/github.rs` | github_list_repos, github_get_repo |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| B.3 | 添加 TS 类型 | `lib/types.ts` | GitHubRepo 接口 |
| B.4 | 添加命令封装 | `lib/tauriCommands.ts` | githubListRepos, githubGetRepo |
| B.5 | 实现 GitHubRepoList 组件 | `components/GitHubRepoList.tsx` | 搜索/筛选/分页的仓库列表 |
| B.6 | 改造 Home 页 | `routes/Home.tsx` | 认证后显示"GitHub Repos"区块 |
| B.7 | 一键克隆集成 | `routes/Home.tsx` | 点击仓库 -> 预填充克隆 URL -> 触发克隆流程 |

**M4-B 验收标准**：

- 认证用户可在主页看到自己的仓库列表
- 支持搜索/筛选仓库
- 仓库卡片显示名称、描述、语言（带颜色标记）、Star 数
- 点击"Clone"预填充克隆 URL 并触发克隆
- 克隆后远程仓库自动配置正确
- 支持分页加载（100+ 仓库用户）

---

#### M4-C：Pull Request 功能

**目标**：完整的 PR 生命周期管理——列表、查看、创建、合并、评论。

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| C.1 | 实现 PR 相关 API | `github/pulls.rs` | list_pulls, get_pull, create_pull, merge_pull, get_pull_files, get_pull_diff, list/create_comments |
| C.2 | 添加 PR 相关命令 | `commands/github.rs` | 所有 PR 操作命令 |
| C.3 | 注册新命令 | `lib.rs` | 注册 PR 命令 |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| C.4 | 添加 PR 类型定义 | `lib/types.ts` | GitHubPullRequest, PRBranchRef, CreatePullRequest, PullRequestFile 等 |
| C.5 | 添加 PR 命令封装 | `lib/tauriCommands.ts` | 所有 PR 命令的 TS 封装 |
| C.6 | 实现 PRList 组件 | `components/PRList.tsx` | Open/Closed 标签页，PR 卡片展示 |
| C.7 | 实现 PRDetail 组件 | `components/PRDetail.tsx` | PR 详情 + Changes/Comments 标签页 |
| C.8 | 实现 PRCreateDialog 组件 | `components/PRCreateDialog.tsx` | 创建 PR 弹窗（base/head 分支选择） |
| C.9 | 实现 patch 解析工具 | `lib/diffParser.ts` | GitHub unified diff -> DiffResult 转换 |
| C.10 | 创建 PR 路由页 | `routes/GitHubPRs.tsx` | PR 列表+详情布局 |
| C.11 | 添加 PR 路由 | `index.tsx` | `/pulls` 路由 |
| C.12 | 修改 Navbar | `components/Navbar.tsx` | 认证+打开仓库后显示"PRs"导航项 |
| C.13 | 修改 Repository 页 | `routes/Repository.tsx` | 工具栏添加 PR 按钮 |

**M4-C 验收标准**：

- 可查看当前仓库的 PR 列表（Open/Closed 筛选）
- 点击 PR 查看详情（标题、描述、分支信息、状态、mergeable）
- "Changes" 标签页展示变更文件列表，点击后在 DiffView 中查看差异
- "Comments" 标签页展示评论
- 可从当前分支创建 PR（自动检测 base/head 分支）
- 可合并 PR（选择 merge/squash/rebase 方式）
- 仅认证且打开 GitHub 远程仓库时可访问 PR 功能

---

### M5：体验打磨

| # | 任务 | 说明 |
|---|------|------|
| 5.1 | 大仓库性能优化 | 虚拟滚动提交列表、增量加载图数据 |
| 5.2 | 提交图动画与过渡效果 | 流畅的节点动画和分支高亮 |
| 5.3 | 二进制文件降级策略 | 图片预览、二进制提示、LFS 标记 |
| 5.4 | 子模块检测与提示 | 检测 `.gitmodules`，提示用户 |
| 5.5 | 键盘快捷键 | 常用操作快捷键绑定 |
| 5.6 | 国际化 (i18n) | 中/英文支持 |
| 5.7 | CI/CD 流水线 | GitHub Actions：lint + test + build |

---

## 前后端接口定义

### 核心 Tauri Commands

```
// === 仓库管理（已有）===
open_repo / get_recent_repos / save_repo_path / remove_recent_repo / clone_repo

// === 工作区状态（已有）===
get_status / stage_files / unstage_files / get_conflicts / resolve_conflict

// === 提交（已有）===
commit / get_commit_history / get_commit_graph / get_commit_detail / rebase / cherry_pick

// === 分支（已有）===
get_branch_list / create_branch / checkout_branch / delete_branch

// === Diff（已有）===
get_file_diff / get_file_content

// === 远程（已有）===
get_remotes / fetch / pull / push

// === Stash（已有）===
stash_save / stash_list / stash_pop / stash_apply / stash_drop

// === GitHub 认证（M4-A 新增）===
github_start_login     -> DeviceFlowResponse    // 启动设备流认证
github_poll_login      -> GitHubUser            // 轮询令牌并获取用户信息
github_check_auth      -> AuthStatus            // 检查当前认证状态
github_logout          -> ()                    // 退出登录，清除令牌
github_get_user        -> GitHubUser            // 获取当前用户信息

// === GitHub 仓库（M4-B 新增）===
github_list_repos      -> Vec<GitHubRepo>       // 列出用户仓库（分页）
github_get_repo        -> GitHubRepo            // 获取单个仓库信息

// === GitHub PR（M4-C 新增）===
github_list_pulls      -> Vec<GitHubPullRequest>
github_get_pull        -> GitHubPullRequest
github_create_pull     -> GitHubPullRequest
github_merge_pull      -> MergePullResult
github_get_pull_files  -> Vec<PullRequestFile>
github_get_pull_diff   -> String                // 原始 unified diff
github_list_pull_comments   -> Vec<PRComment>
github_create_pull_comment  -> PRComment
```

---

## 开发规范

- **Git 分支策略**：`main`（稳定）← `dev`（开发）← `feature/*`（功能分支）
- **提交规范**：中文提交信息，格式 `类型: 描述`
- **代码检查**：`npx tsc --noEmit`（前端）+ `cargo fmt` + `cargo clippy`（后端）
- **接口优先**：新功能先定好 Tauri Command 的输入输出结构，再分头实现前后端
- **令牌安全**：OAuth 令牌仅在后端处理，前端永不到达令牌原文

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `keyring` Linux 兼容性 | 令牌无法持久化 | 回退到应用数据目录加密文件 |
| GitHub API 限流 | 操作随机失败 | 处理 403/429 响应，展示限流信息 |
| 大 PR Diff 性能 | 加载缓慢 | 按需逐文件加载 Diff |
| 设备流 UX 困惑 | 用户不知如何操作 | 清晰 UI 指引 + 自动打开浏览器 + 轮询反馈 |
