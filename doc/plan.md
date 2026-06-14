# VaporGit 全面优化方案

> 当前版本：v1.2.5 | 制定日期：2026-06-14

## 当前状态评估

| 维度 | 状态 | 评级 |
|------|------|------|
| 功能完整度 | 核心 Git 工作流 + GitHub/Gitee PR + 终端 + 冲突解决 | ⭐⭐⭐⭐ |
| 代码架构 | 三层清晰（commands→git→models），存在重复和单体组件 | ⭐⭐⭐ |
| 测试覆盖 | 前端/后端均无自动化测试 | ⭐ |
| 安全 | CSP + 路径验证 + Token 存储已达标 | ⭐⭐⭐⭐ |
| 性能 | 提交图 2000 节点限制，文件列表无虚拟化 | ⭐⭐⭐ |
| 开发体验 | 无 CI 类型检查、无 lint rule、旧版 CI action | ⭐⭐ |

---

## 一、架构优化（高优先级）

### 1.1 Repository.tsx 拆分（1498 行单体 → 模块化）

当前 `Repository.tsx` 承载了布局、所有模态框、所有 Git 操作、键盘快捷键、状态管理，是项目中最复杂的文件。建议拆分为：

```
src/routes/repository/
  index.tsx               (~100 行)  编排层，组合子组件
  RepositoryToolbar.tsx   (~120 行)  3 行操作按钮（Fetch/Pull/Push, Undo/Redo/Stash, Rebase/Merge/PR）
  CommitInput.tsx         (~80 行)   commit message + amend checkbox + 提交按钮
  LeftPanel.tsx           (~150 行)  左侧面板模式切换（graph/branches ↔ detail ↔ diff）
  RightPanel.tsx          (~80 行)   右侧面板容器（toolbar + file list + commit area）
  ModalsContainer.tsx     (~100 行)  管理所有模态框的显示/隐藏与事件传递
  useRepositoryActions.ts (~200 行)  所有 Git 操作逻辑 hook（提交、暂存、fetch 等）
  useRepositoryModals.ts  (~80 行)   模态框状态管理 hook
```

**目标：** Repository/index.tsx ≤ 150 行，子组件 ≤ 200 行。

### 1.2 统一 GitHub/Gitee 平台抽象

前后端均存在代码重复：

**前端（6 对镜像组件）：**

| GitHub | Gitee | 行数（近似） |
|--------|-------|------------|
| `GitHubLogin.tsx` | `GiteeLogin.tsx` | ~80 |
| `PRList.tsx` | `GiteePRList.tsx` | ~120 |
| `PRDetail.tsx` | `GiteePRDetail.tsx` | ~180 |
| `PRCreateDialog.tsx` | `GiteePRCreateDialog.tsx` | ~100 |
| `GitHubRepoList.tsx` | `GiteeRepoList.tsx` | ~100 |
| `GitHubUserMenu.tsx` | `GiteeUserMenu.tsx` | ~50 |

**建议方案：**

```
src/components/platform/
  PlatformLogin.tsx          ← 统一 GitHubLogin + GiteeLogin
  PlatformPRList.tsx         ← 统一 PRList + GiteePRList
  PlatformPRDetail.tsx       ← 统一 PRDetail + GiteePRDetail
  PlatformPRCreateDialog.tsx ← 统一 PRCreateDialog + GiteePRCreateDialog
  PlatformRepoList.tsx       ← 统一 GitHubRepoList + GiteeRepoList
  PlatformUserMenu.tsx       ← 统一 GitHubUserMenu + GiteeUserMenu

src/lib/platformAdapter.ts  ← 平台适配器接口定义 + GitHub/Gitee 实现
```

- `PlatformAdapter` 接口定义统一的 API 调用签名（login, listRepos, listPRs, getPR, createPR, mergePR, getUser 等）
- 组件通过 `props.platform: 'github' | 'gitee'` 选择适配器
- 消除 ~630 行重复代码

**后端：** `github/auth.rs` 改用 `oauth::flow::start_auth_code_flow()`，删除重复 PKCE 实现（~120 行）。

### 1.3 状态管理集中化

当前 `Repository.tsx` 中有 20+ 个局部 `createSignal`（stashModal、remoteModal、conflictModal 等），散落在组件中难以追踪。

**建议：** 新增或扩展现有 store：

```
stores/
  repositoryStore.ts   ← 新增：modal 状态、action loading 状态、repository 级 UI 状态
```

将以下信号集中管理：
- 模态框开关：`stashOpen`、`remoteOpen`、`conflictOpen`、`mergeOpen`、`rebaseOpen`、`branchCompareOpen`、`pushDialogOpen`、`prCreateOpen`、`branchCreateOpen`
- 加载状态：`stagingLoading`、`committingLoading`、`undoLoading`、`redoLoading`、`fetchLoading`、`pullLoading`、`pushLoading`
- 面板模式：`leftPanelMode`、`selectedFile`、`selectedCommit`

---

## 二、性能优化（高优先级）

### 2.1 文件列表虚拟化

`FileList.tsx` 当前渲染全部 `FileStatus[]` 条目。大型仓库（数千文件变更）时 DOM 节点过多导致卡顿。

- 引入 `@tanstack/solid-virtual` 进行虚拟滚动
- 为 `For`/`Index` 循环添加窗口化渲染（仅渲染可视区域内的文件行）
- 固定行高可以减少计算（约 36px 每行）

### 2.2 提交图增量加载

- 当前硬限制 2000 节点，建议添加分页加载（滚动到底部自动加载更多）
- Canvas 渲染部分可考虑将 lane 分配计算移到 Web Worker

### 2.3 Diff 视图大文件优化

- 大文件 Diff（>1000 行）渲染时可能卡顿
- 对 Unified/Split 模式添加行级虚拟化，仅渲染可视区域
- Split view 左右同步滚动可开启 `requestAnimationFrame` 节流

### 2.4 构建产物体积

- 检查 Tauri bundle 资源是否包含不必要的文件
- Vite 构建可启用 `build.minify: 'terser'`（替代默认 esbuild）进一步压缩

---

## 三、测试与质量保障（高优先级）

### 3.1 Rust 后端测试

当前覆盖率为零。优先为核心模块添加集成测试：

```
src-tauri/tests/
  repo_test.rs        ← open_repo、init_repo（使用 tempdir 创建测试仓库）
  status_test.rs      ← get_status、stage_files、unstage_files、discard_files
  commit_test.rs      ← commit、amend_commit、undo、redo
  branch_test.rs      ← create_branch、checkout_branch、delete_branch、compare_branches
  merge_test.rs       ← merge_branch（三种策略）
  remote_test.rs      ← fetch、pull、push（使用本地 bare repo 模拟远程）
  stash_test.rs       ← stash_save、stash_list、stash_pop
  validate_test.rs    ← validate_ref_name、validate_path_in_workdir
  oauth_token_test.rs ← TokenStore save/load/clear
```

依赖 crate（dev-dependencies）：`tempfile`

### 3.2 TypeScript 前端测试

引入 `vitest` + 配套工具：

```
src/lib/
  __tests__/
    tauriCommands.test.ts   ← mock invoke()，验证参数传递与返回值类型
    gitErrorDesc.test.ts    ← describeError() 各种错误模式匹配
    diffParser.test.ts      ← GitHub diff patch 解析
    platformAdapter.test.ts ← 平台适配器接口一致性验证

src/stores/
  __tests__/
    repoStore.test.ts
    diffStore.test.ts
    commitStore.test.ts
    settingsStore.test.ts
```

devDependencies 新增：`vitest`、`@solidjs/testing-library`（组件测试用）、`@testing-library/user-event`

### 3.3 CI 流水线增强

新增 `.github/workflows/ci.yml`（不同于 release.yml，在 push/PR 时触发）：

```yaml
name: CI
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 26 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev
      - run: cargo check
        working-directory: src-tauri
      - run: cargo test
        working-directory: src-tauri
      - run: cargo clippy -- -D warnings
        working-directory: src-tauri
```

---

## 四、代码质量与安全性（中优先级）

### 4.1 Rust Lint 强化

在 `src-tauri/Cargo.toml` 添加：

```toml
[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
all = "warn"
pedantic = "warn"
nursery = "warn"
cargo = "warn"
```

随后逐步修复 clippy warnings。

### 4.2 TypeScript 运行时类型校验

当前 `tauriCommands.ts` 的 `invoke<T>()` 泛型仅在编译时生效，后端返回数据未在运行时校验。

- 引入 `valibot`（体积小，tree-shakable）为核心 API 返回值添加 schema 校验
- 优先覆盖：`openRepo` → `RepoInfo`、`getStatus` → `FileStatus[]`、`getCommitHistory` → `CommitInfo[]`、`getCommitGraph` → `CommitGraphData`

### 4.3 错误处理全面审查

- 扫描所有 `tauriCommands.ts` 调用点，确认每个 `catch` 块都有 `addToast()` 或 `console.error()`
- 扫描所有 `String(e)` 用法，确认已替换为 `describeError(e)`
- `describeError()` 正则覆盖是否完整（新增场景：submodule、worktree）

### 4.4 安全加固

| 项目 | 当前状态 | 建议 |
|------|---------|------|
| CSP | `default-src 'self'` + 少量例外 | 考虑使用 nonce 替代 `'unsafe-inline'`（style） |
| `deleteDir` 命令 | 无路径验证 | 添加 `validate_path_in_workdir()` 或操作前二次确认 |
| `discard_files` | 已有路径验证 | 审计 `stage_files`/`unstage_files` 也使用了路径验证 |
| `initRepo` 命令 | 接收任意路径 | 确认不会覆盖非空目录 |
| OAuth client_id | 支持 env var 覆盖 | 保持现状即可 |

---

## 五、功能完善（中优先级）

### 5.1 Git 功能补全

| 功能 | 当前状态 | 建议 |
|------|---------|------|
| `git tag` | 只支持创建 | 增加 `list_tags`、`delete_tag` 命令 + 前端 Tag 列表 UI |
| `git submodule` | 只有 `check_submodules` 检测 | 增加 `submodule_add`、`submodule_update`、`submodule_init` |
| `git blame` | 无 | 后端 `git_blame` 命令 + 文件逐行 blame 视窗 |
| `git reflog` | redo 内部使用 | 暴露 `get_reflog` 命令 + 前端 Reflog 查看 UI |
| `git worktree` | 无 | 低优先级，后期考虑 |
| `git bisect` | 无 | 低优先级，后期考虑 |

### 5.2 行级暂存 UI 集成

- 后端已有 `stage_hunk`、`stage_line` 命令
- 确认 `DiffView.tsx` 中差异行可逐行/逐块点击暂存（类似 GitKraken）
- 如未集成，在 DiffView 行号左侧添加 "+" 按钮

### 5.3 LFS 完整支持

- 当前只有 `check_lfs` 检测文件是否为 LFS 指针
- 增加 `lfs_pull`、`lfs_track`、`lfs_untrack` 命令
- 前端文件列表中对 LFS 文件标注图标

### 5.4 SSH 密钥管理

- 当前 SSH 依赖 `ssh_key_from_agent`（自动使用 ssh-agent）
- 可增加 Settings 中手动指定 SSH 密钥路径
- 增加"测试 SSH 连接"按钮（`ssh -T git@github.com` 类似功能）

---

## 六、开发体验优化（中优先级）

### 6.1 统一开发命令

在 `package.json` 中新增：

```json
{
  "scripts": {
    "check": "npx tsc --noEmit",
    "check:rust": "cd src-tauri && cargo check",
    "lint": "npx oxlint",
    "lint:rust": "cd src-tauri && cargo clippy",
    "test": "npx vitest run",
    "test:rust": "cd src-tauri && cargo test",
    "precommit": "npx tsc --noEmit && cd src-tauri && cargo check"
  }
}
```

### 6.2 Pre-commit Hook

- 使用 `lefthook`（Rust 原生，跨平台，比 husky 更适合 Tauri 项目）
- 提交前自动运行：类型检查 + cargo check（非测试，避免耗时过长）

### 6.3 CI/CD 组件升级

- `tauri-apps/tauri-action@v0` → `@v2`
- `swatinem/rust-cache@v2` → `@v3`（如有）
- 增加 `actions/cache` 缓存 npm 和 cargo 依赖

---

## 七、UI/UX 优化（低优先级）

### 7.1 无障碍（Accessibility）

- 为工具栏按钮添加 `aria-label`
- 文件列表支持键盘导航（↑↓ 选择文件，Space 暂存/取消暂存）
- 提交图支持键盘左右导航

### 7.2 国际化完整性检查

新增 `scripts/check-i18n.mjs`：

```js
// 以 en.ts 为基准，扫描所有语言文件
// 报告缺失的 key 和多余 key
// 输出对比报告
```

### 7.3 操作确认对话框

- `discard_files` 增加确认弹窗（"确定放弃对 N 个文件的更改吗？此操作不可撤销。"）
- `delete_branch` 未合并警告（目前可能直接删除）

---

## 八、实施计划

### 阶段一：基础质量保障（立即执行，预计 2-3 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 1.1 | 创建 `.github/workflows/ci.yml`（类型检查 + 构建验证） | P0 |
| 1.2 | Rust 核心模块测试：`repo_test.rs`、`status_test.rs`、`commit_test.rs`、`validate_test.rs` | P0 |
| 1.3 | Rust 添加 `clippy` lint rules + 修复现有 warnings | P0 |
| 1.4 | `package.json` 添加 `check`/`lint`/`test` 命令 | P0 |
| 1.5 | 后端 `github/auth.rs` 改用 `oauth::flow` 消除重复代码 | P1 |

### 阶段二：架构重构（短期，预计 3-5 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 2.1 | Repository.tsx 拆分为 `src/routes/repository/` 子模块 | P0 |
| 2.2 | 新增 `repositoryStore.ts` 集中管理 modal 和 loading 状态 | P1 |
| 2.3 | 安全审计：`deleteDir` 路径验证、`discard_files` 确认弹窗 | P1 |
| 2.4 | `scripts/check-i18n.mjs` 国际化完整性检查脚本 | P2 |

### 阶段三：性能优化（短期，预计 2-3 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 3.1 | 文件列表虚拟化（`@tanstack/solid-virtual`） | P1 |
| 3.2 | 提交图增量加载（超出 500 节点时分页） | P2 |
| 3.3 | Diff 视图大文件行级虚拟化 | P2 |

### 阶段四：平台抽象统一（中期，预计 3-4 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 4.1 | 创建 `src/lib/platformAdapter.ts` 接口定义 | P1 |
| 4.2 | 创建 `src/components/platform/` 统一组件（6 个） | P1 |
| 4.3 | 删除旧 GitHub/Gitee 独立组件（12 个） | P1 |
| 4.4 | 更新相关路由和 store 引用 | P1 |

### 阶段五：测试完善（中期，预计 2-3 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 5.1 | TypeScript 前端测试：`describeError`、`diffParser`、stores | P1 |
| 5.2 | Rust 后端补充：`branch_test.rs`、`merge_test.rs`、`remote_test.rs`、`stash_test.rs` | P2 |
| 5.3 | CI 中添加 `cargo test` 和 `vitest run` 步骤 | P1 |

### 阶段六：功能补全（长期，持续进行）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 6.1 | Tag 列表/删除 UI | P2 |
| 6.2 | Submodule 操作（add/update/init） | P2 |
| 6.3 | Blame 视图 | P3 |
| 6.4 | LFS 完整支持 | P3 |
| 6.5 | 行级暂存 UI 集成（DiffView 中添加按钮） | P2 |
| 6.6 | SSH 密钥手动配置 | P3 |
| 6.7 | Reflog 查看 UI | P3 |

### 阶段七：CI/CD 与 DX（中期，预计 1-2 天）

| 序号 | 任务 | 优先级 |
|------|------|--------|
| 7.1 | `tauri-action@v0` → `@v2` | P2 |
| 7.2 | Pre-commit hook（lefthook） | P2 |
| 7.3 | Accessibility 基础支持（aria-label + 键盘导航） | P3 |

---

## 九、技术依赖及选型

| 目的 | 选型 | 理由 |
|------|------|------|
| 文件列表虚拟化 | `@tanstack/solid-virtual` | SolidJS 原生支持，轻量 |
| 前端测试 | `vitest` | 与 Vite 生态一致，快速 |
| 组件测试 | `@solidjs/testing-library` | SolidJS 官方推荐 |
| 运行时校验 | `valibot` | Tree-shakable，体积 <1KB |
| Pre-commit | `lefthook` | Rust 原生，跨平台无 Node 依赖 |
| Lint（前端） | `oxlint` | Rust 原生，极快，无需配置 |
| Rust 测试仓库 | `tempfile` crate | 标准方案 |

---

*本方案由 Agent 制定，随项目演进而更新。各阶段完成后需验证并通过 CI。*

---

## 进度更新（统一记录）

### 执行进度（2026-06-14）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段一：基础质量保障 | 已完成 | CI、前端测试/lint/check 脚本、Rust baseline 测试、clippy 配置已落地；CI 报错和 warning 已修复并验证通过。 |
| 阶段二：架构重构 | 已完成主体 | `Repository.tsx` 已拆出 `LeftPanel`、`RightPanel`、`ModalsContainer`、`RepositoryToolbar`、`CommitInput`、`useRepositoryActions`、`useRepositoryModals` 与 `repositoryStore`；平台 PR 路由和 GitHub/Gitee PR/仓库/用户菜单统一抽象已完成。 |
| 阶段三：性能优化 | 已完成主体 | 文件列表扁平模式已接入 `@tanstack/solid-virtual`；按用户要求取消提交图增量加载，保持原视图；Diff 行级虚拟化已完成。 |
| 阶段四：平台抽象统一 | 已完成主体 | `PlatformAdapter` 已覆盖登录、鉴权、仓库、分支、PR 列表/详情/创建/合并、PR 文件/评论；通用平台组件已替代旧 GitHub/Gitee 镜像组件。 |
| 阶段五：测试完善 | 已完成主体 | 已覆盖 `describeError`、`diffParser`、stores、`tauriCommands`、`platformAdapter`；Rust 已补充 branch/merge/remote/stash/repo/status/commit/oauth token 集成测试。 |
| 阶段六：功能补全 | 已完成主体 | Tag/Submodule/Blame/Reflog/LFS/SSH Tauri wrapper、后端命令与仓库级 UI 入口已完成。 |
| 阶段七：CI/CD 与 DX | 已完成主体 | CI/release action 已升级到可解析版本，lefthook、oxlint、i18n 检查脚本已接入；`swatinem/rust-cache@v3` 当前不存在，release/CI 保持最新可用 `v2.9.1` 所在的 `@v2`。 |

### 平台抽象轮次

- [x] 扩展 `PlatformAdapter` 合约与 valibot 边界校验，补齐 PR head/base、统计字段、分支、PR 文件和评论。
- [x] 新增 `PlatformPRList`、`PlatformPRDetail`、`PlatformPRCreateDialog`，替代 GitHub/Gitee 两套 PR 组件。
- [x] 新增 `PlatformRepoList`、`PlatformUserMenu`，替代 GitHub/Gitee 两套仓库列表和用户菜单。
- [x] 将 `GitHubPRs`、`GiteePRs` 收敛为 `PlatformPRs` 的薄 wrapper。
- [x] 删除旧 GitHub/Gitee 镜像 PR、RepoList、UserMenu 组件。
- [x] 增加 platformAdapter PR 字段测试。

### 性能与功能补全轮次

- [x] 完成 Diff 视图大文件行级虚拟化：Unified、Split、Full File 三种视图均改用 `@tanstack/solid-virtual`，并保留 hunk/line staged 操作。
- [x] 按用户要求保留提交图原本视图：未实现“超过 500 节点分页/增量加载”，仍沿用现有 2000 节点截断提示。
- [x] 新增仓库级 `GitToolsPanel`，从工具栏入口覆盖 Tag 列表/删除、Submodule add/init/update、Blame、Reflog、LFS pull/track/untrack、SSH 连接测试。
- [x] 扩展 `repositoryStore` modal 状态，统一管理 Git Tools 面板开关。
- [x] 本轮验证已通过：`npm run check`、`npm run lint`、`npm run test`、`npm run build`、`cargo check`、`cargo test`、`cargo clippy -- -D warnings`、`npm audit`。

### 测试补强轮次

- [x] 将 `git` 与 `models` 模块暴露给 Rust integration tests，便于测试真实后端实现而不是复刻 `git2` 行为。
- [x] 新增 `src-tauri/tests/common/` 测试仓库辅助工具，统一临时仓库初始化、用户配置、写文件和提交逻辑。
- [x] 新增 `branch_test.rs`，覆盖分支创建、切换、对比、删除以及禁止删除当前分支。
- [x] 新增 `merge_test.rs`，覆盖 fast-forward merge 和 squash merge 的工作区/索引结果。
- [x] 新增 `remote_test.rs`，覆盖 remote add/set/delete 以及本地 bare repo push/fetch 往返。
- [x] 新增 `stash_test.rs`，覆盖 stash save/list/pop/apply/drop。
- [x] 本轮 Rust 验证已通过：`cargo check`、`cargo test --target-dir target/codex-test -j 1`、`cargo clippy -- -D warnings`。

### 全面收口轮次

- [x] 完成 Repository 主页面剩余拆分：新增 `LeftPanel`、`RightPanel`、`ModalsContainer`、`useRepositoryActions`、`useRepositoryModals`，主页面保留数据加载、状态编排和 handler 接线。
- [x] 修复 `amend_commit` 使用普通 commit 替代 amend 导致的 libgit2 `current tip is not the first parent` 错误，改用 `Commit::amend()`。
- [x] 新增 `repo_test.rs`，覆盖 repo 初始化、非空目录拒绝、仓库信息、`.gitmodules` fallback 解析。
- [x] 新增 `status_test.rs`，覆盖未跟踪文件暂存/取消暂存、丢弃 tracked/untracked 更改、拒绝 `..` 路径。
- [x] 新增 `commit_test.rs`，覆盖 commit history/detail、amend、undo/redo。
- [x] 新增 `oauth_token_test.rs`，覆盖 TokenStore save/load/clear。
- [x] 将本轮新增的 `repo.gitTools`、`repo.undoCommitSuccess`、`repo.redoCommitSuccess` 同步到所有语言包，避免扩大现有 i18n drift。
- [x] 本轮验证已通过：`npm run check`、`npm run lint`、`npm run test`、`npm run build`、`npm audit`、`npm run check:i18n`（退出码 0；仍报告历史语言包 drift）、`cargo check --target-dir target/codex-check`、`cargo test --target-dir target/codex-test -j 1`、`cargo clippy --target-dir target/codex-clippy -- -D warnings`。

### i18n drift 彻底收口轮次

- [x] 以 `en.ts` 为基准，补齐 `ar/de/es/fr/ja/ko/pt/ru/zh-TW/zh` 全部历史缺失 key，并按基准 key 顺序归一化语言包结构。
- [x] 将 PR 合并冲突相关文案统一到通用 `pr.mergeConflict` / `pr.checkingMerge`，从旧的 `github.mergeConflict` / `github.checkingMerge` 命名迁出，匹配 `PlatformPRDetail` 的实际调用。
- [x] 移除历史 extra key：`settings.github` 与旧位置的 `github.mergeConflict` / `github.checkingMerge`。
- [x] 本轮验证已通过：`node scripts/check-i18n.mjs --strict`（11 个 locale 全部通过）、`npm run check`、`npm run lint`、`npm run test`、`npm run build`。

### 下一步建议

- [ ] 合并前可按发布流程决定是否整理 CHANGELOG 与版本号；当前优化分支不自动发布。
