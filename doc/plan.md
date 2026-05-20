# VaporGit 详细开发计划

## 项目现状

VaporGit 当前处于 **v0.1.0 初始化阶段**，已完成：

- Tauri v2 + SolidJS + TypeScript + Tailwind CSS v4 脚手架搭建
- 自定义标题栏（窗口控制：最小化/最大化/关闭）+ 导航栏（主页/仓库）
- 前端路由：`/`（主页）和 `/repository`（仓库占位页）
- Rust 后端仅有一个示例 `greet` 命令，尚未集成 `git2`

**关键依赖已就绪**：`@tauri-apps/api@^2`、`solid-js@^1.9`、`@solidjs/router@^0.16`、`serde`/`serde_json`

**关键缺失**：`git2` crate（Rust 端 Git 操作库）尚未添加到 Cargo.toml

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
| 提交树渲染 | Canvas（优先） | 大仓库（万级提交）性能优于 DOM/SVG |
| 前端状态管理 | SolidJS `createStore` + Context | 轻量，无额外依赖，与框架深度集成 |
| Diff 视图 | 自研组件 | 可控性高，支持 side-by-side 和 unified 双模式 |
| 大文件处理 | 流式读取 + 虚拟滚动 | 避免内存暴涨 |

### 目录结构规划

```
src/
├── components/
│   ├── Navbar.tsx              # [已有] 导航栏
│   ├── Titlebar.tsx            # [已有] 自定义标题栏
│   ├── RepoSelector.tsx        # 仓库选择器/最近列表
│   ├── StatusBar.tsx           # 底部状态栏
│   ├── CommitGraph.tsx         # DAG 提交树 (Canvas)
│   ├── DiffView.tsx            # 文件差异视图
│   ├── FileList.tsx            # 工作区文件列表
│   ├── BranchList.tsx          # 分支列表
│   └── CommitDetail.tsx        # 提交详情面板
├── routes/
│   ├── Home.tsx                # [已有] 主页/仓库打开
│   └── Repository.tsx          # [已有] 仓库主工作区
├── stores/
│   ├── repoStore.ts            # 仓库状态（HEAD/分支/工作区）
│   ├── commitStore.ts          # 提交历史/图数据
│   ├── diffStore.ts            # Diff 数据/选中文件
│   └── settingsStore.ts        # 用户设置
├── lib/
│   ├── tauriCommands.ts        # Tauri invoke 封装
│   └── types.ts                # 共享类型定义
├── App.tsx                     # [已有] 根布局
├── App.css                     # [已有] 全局样式
└── index.tsx                   # [已有] 入口

src-tauri/src/
├── main.rs                     # [已有] 入口
├── lib.rs                      # [已有] Tauri Builder + 命令注册
├── commands/
│   ├── mod.rs
│   ├── repo.rs                 # 仓库管理命令
│   ├── commit.rs               # 提交/历史命令
│   ├── branch.rs               # 分支操作命令
│   ├── diff.rs                 # Diff 文件命令
│   ├── remote.rs               # 远程操作命令
│   └── stash.rs                # Stash 命令
├── git/
│   ├── mod.rs
│   ├── repo.rs                 # git2::Repository 封装
│   ├── commit.rs               # 提交查询与操作
│   ├── branch.rs               # 分支管理
│   ├── diff.rs                 # Diff 生成
│   ├── status.rs               # 工作区状态
│   └── remote.rs               # Fetch/Pull/Push
└── models/
    ├── mod.rs
    ├── commit.rs               # 提交元数据模型
    ├── branch.rs               # 分支模型
    ├── diff.rs                 # Diff 模型
    └── status.rs               # 文件状态模型
```

---

## 里程碑与迭代计划

### M1：可用的基础版（目标：可日常使用的基础 Git 操作）

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1.1 | 添加 `git2` 依赖 | `Cargo.toml` | 添加 `git2 = "0.19"` |
| 1.2 | 实现 `open_repo(path)` 命令 | `commands/repo.rs`, `git/repo.rs` | 打开本地仓库，返回基本信息 |
| 1.3 | 实现 `get_status(path)` 命令 | `commands/repo.rs`, `git/status.rs` | 返回工作区文件状态列表 |
| 1.4 | 实现 `stage_files(path, files)` / `unstage_files(path, files)` | `commands/repo.rs`, `git/status.rs` | 暂存/取消暂存 |
| 1.5 | 实现 `commit(path, message)` | `commands/commit.rs`, `git/commit.rs` | 创建提交 |
| 1.6 | 实现 `get_commit_history(path, page, size)` | `commands/commit.rs`, `git/commit.rs` | 分页获取提交列表 |
| 1.7 | 实现 `get_file_diff(path, file_path, commit_id?)` | `commands/diff.rs`, `git/diff.rs` | 获取文件差异 |
| 1.8 | 实现 `get_recent_repos()` / `save_repo_path(path)` | `commands/repo.rs` | 最近仓库列表持久化（本地 JSON 文件） |
| 1.9 | 定义所有前端数据模型 | `models/*.rs` | CommitInfo, FileStatus, DiffResult, BranchInfo 等 |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 1.10 | 封装 Tauri invoke 调用 | `lib/tauriCommands.ts` | 类型安全的命令封装 |
| 1.11 | 定义 TypeScript 类型 | `lib/types.ts` | 与 Rust 模型对应 |
| 1.12 | 实现 `repoStore` | `stores/repoStore.ts` | 仓库路径、HEAD、分支、状态摘要 |
| 1.13 | 实现 `diffStore` | `stores/diffStore.ts` | 选中文件、Diff 内容、视图模式 |
| 1.14 | 改造主页：打开仓库 + 最近列表 | `routes/Home.tsx`, `components/RepoSelector.tsx` | 替换占位卡片为功能组件 |
| 1.15 | 实现仓库页主布局 | `routes/Repository.tsx` | 左侧文件列表 + 右侧 Diff 面板 |
| 1.16 | 实现 `FileList` 组件 | `components/FileList.tsx` | 文件树 + 状态图标 + 暂存操作 |
| 1.17 | 实现 `DiffView` 组件（基础版） | `components/DiffView.tsx` | Unified 模式行级高亮 |
| 1.18 | 实现提交历史列表 | `routes/Repository.tsx` 内 | 提交列表 + 点击查看详情 |
| 1.19 | 实现 `StatusBar` 组件 | `components/StatusBar.tsx` | 当前分支、领先/落后、工作区状态 |
| 1.20 | 实现暂存/提交工作流 | `routes/Repository.tsx` | 文件暂存 → 输入 message → 提交 |

**M1 验收标准**：

- 能打开本地 Git 仓库并显示文件状态
- 能暂存/取消暂存文件
- 能创建提交
- 能查看文件 Diff（Unified 模式）
- 能浏览提交历史列表

---

### M2：图形增强版（目标：可视化 DAG 提交树 + 分支管理）

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 2.1 | 实现 `get_commit_graph(path)` | `commands/commit.rs`, `git/commit.rs` | 返回 DAG 图数据（节点+边） |
| 2.2 | 实现 `get_branch_list(path)` | `commands/branch.rs`, `git/branch.rs` | 本地+远程分支列表 |
| 2.3 | 实现 `create_branch(path, name, from?)` | `commands/branch.rs` | 创建分支 |
| 2.4 | 实现 `checkout_branch(path, name)` | `commands/branch.rs` | 切换分支 |
| 2.5 | 实现 `delete_branch(path, name)` | `commands/branch.rs` | 删除分支 |
| 2.6 | 实现 `get_commit_detail(path, id)` | `commands/commit.rs` | 单个提交完整信息（作者/时间/父提交/文件变更列表） |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 2.7 | 实现 `CommitGraph` 组件 | `components/CommitGraph.tsx` | Canvas 渲染 DAG 图 |
| 2.8 | 实现 `BranchList` 组件 | `components/BranchList.tsx` | 分支列表 + 切换/创建/删除 |
| 2.9 | 实现 `commitStore` | `stores/commitStore.ts` | 图数据、分支数据、选中提交 |
| 2.10 | 实现 `CommitDetail` 组件 | `components/CommitDetail.tsx` | 提交详情面板 |
| 2.11 | 提交树与 Diff 联动 | `routes/Repository.tsx` | 点击提交节点 → 右侧显示变更文件列表 + Diff |
| 2.12 | Side-by-side Diff 模式 | `components/DiffView.tsx` | 双栏对比视图 |

**M2 验收标准**：

- DAG 提交树正确渲染，颜色区分分支
- 节点悬停显示提交信息
- 点击节点联动右侧 Diff
- 分支创建/切换/删除功能正常
- Side-by-side 与 Unified 模式可切换

---

### M3：进阶协作版（目标：远程同步 + 冲突处理 + 扩展功能）

**后端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 3.1 | 实现 `fetch(path, remote?)` | `commands/remote.rs`, `git/remote.rs` | Fetch 远程 |
| 3.2 | 实现 `pull(path, remote?, branch?)` | `commands/remote.rs` | Pull（含 fast-forward / merge） |
| 3.3 | 实现 `push(path, remote?, branch?)` | `commands/remote.rs` | Push 远程 |
| 3.4 | 实现 `get_remotes(path)` | `commands/remote.rs` | 远程仓库列表 |
| 3.5 | 实现 `get_conflicts(path)` | `commands/repo.rs`, `git/status.rs` | 冲突文件检测 |
| 3.6 | 实现 `resolve_conflict(path, file, resolution)` | `commands/repo.rs` | 标记冲突已解决 |
| 3.7 | 实现 `stash_save/get_list/pop/apply/drop` | `commands/stash.rs` | Stash 完整操作 |
| 3.8 | 实现 `rebase(path, onto)` / `cherry_pick(path, commit)` | `commands/commit.rs` | Rebase 和 Cherry-pick |

**前端任务**：

| # | 任务 | 涉及文件 | 说明 |
|---|------|---------|------|
| 3.9 | 远程同步面板 | `routes/Repository.tsx` | Fetch/Pull/Push 按钮 + 进度 |
| 3.10 | 冲突提示弹窗 | 新建 `components/ConflictResolver.tsx` | 冲突文件列表 + 逐文件解决 UI |
| 3.11 | Stash 管理面板 | 新建 `components/StashPanel.tsx` | Stash 列表 + 应用/弹出/删除 |
| 3.12 | Cherry-pick / Rebase 引导 | 新建 `components/InteractiveRebase.tsx` | 可视化操作引导 |
| 3.13 | 实现 `settingsStore` | `stores/settingsStore.ts` | 用户偏好持久化 |
| 3.14 | 设置页面 | 新建 `routes/Settings.tsx` | 用户设置界面 |

**M3 验收标准**：

- Fetch/Pull/Push 操作正常
- 冲突可检测并逐步解决
- Stash 保存/应用/弹出/列表功能正常
- Cherry-pick 和 Rebase 有可视化引导

---

### M4：体验打磨（目标：性能优化 + 细节完善 + 发布就绪）

| # | 任务 | 说明 |
|---|------|------|
| 4.1 | 大仓库性能优化 | 虚拟滚动提交列表、增量加载图数据 |
| 4.2 | 提交图动画与过渡效果 | 流畅的节点动画和分支高亮 |
| 4.3 | 二进制文件降级策略 | 图片预览、二进制提示、LFS 标记 |
| 4.4 | 子模块检测与提示 | 检测 `.gitmodules`，提示用户 |
| 4.5 | 键盘快捷键 | 常用操作快捷键绑定 |
| 4.6 | 暗色/亮色主题切换 | 跟随系统 + 手动切换 |
| 4.7 | 国际化 (i18n) | 中/英文支持 |
| 4.8 | 自动化测试 | 前端组件测试 + Rust 单元测试 + 集成测试 |
| 4.9 | CI/CD 流水线 | GitHub Actions：lint + test + build |
| 4.10 | 各平台安装包签名 | macOS 签名公证、Windows 代码签名 |

---

## 前后端接口定义

### 核心 Tauri Commands

```rust
// === 仓库管理 ===
#[tauri::command] fn open_repo(path: String) -> Result<RepoInfo, String>;
#[tauri::command] fn get_recent_repos() -> Vec<RecentRepo>;
#[tauri::command] fn save_repo_path(path: String);

// === 工作区状态 ===
#[tauri::command] fn get_status(path: String) -> Result<Vec<FileStatus>, String>;
#[tauri::command] fn stage_files(path: String, files: Vec<String>) -> Result<(), String>;
#[tauri::command] fn unstage_files(path: String, files: Vec<String>) -> Result<(), String>;

// === 提交 ===
#[tauri::command] fn commit(path: String, message: String) -> Result<CommitInfo, String>;
#[tauri::command] fn get_commit_history(path: String, page: u32, page_size: u32) -> Result<Vec<CommitInfo>, String>;
#[tauri::command] fn get_commit_graph(path: String) -> Result<CommitGraphData, String>;
#[tauri::command] fn get_commit_detail(path: String, commit_id: String) -> Result<CommitDetail, String>;

// === 分支 ===
#[tauri::command] fn get_branch_list(path: String) -> Result<Vec<BranchInfo>, String>;
#[tauri::command] fn create_branch(path: String, name: String, from: Option<String>) -> Result<(), String>;
#[tauri::command] fn checkout_branch(path: String, name: String) -> Result<(), String>;
#[tauri::command] fn delete_branch(path: String, name: String) -> Result<(), String>;

// === Diff ===
#[tauri::command] fn get_file_diff(path: String, file_path: String, old_commit: Option<String>, new_commit: Option<String>) -> Result<DiffResult, String>;

// === 远程 ===
#[tauri::command] fn get_remotes(path: String) -> Result<Vec<RemoteInfo>, String>;
#[tauri::command] fn fetch(path: String, remote: Option<String>) -> Result<(), String>;
#[tauri::command] fn pull(path: String, remote: Option<String>, branch: Option<String>) -> Result<PullResult, String>;
#[tauri::command] fn push(path: String, remote: Option<String>, branch: Option<String>) -> Result<(), String>;

// === Stash ===
#[tauri::command] fn stash_save(path: String, message: Option<String>) -> Result<(), String>;
#[tauri::command] fn stash_list(path: String) -> Result<Vec<StashInfo>, String>;
#[tauri::command] fn stash_pop(path: String, index: usize) -> Result<(), String>;
#[tauri::command] fn stash_apply(path: String, index: usize) -> Result<(), String>;
#[tauri::command] fn stash_drop(path: String, index: usize) -> Result<(), String>;
```

### 核心数据模型 (Rust → TS 对应)

```rust
// RepoInfo: 仓库基本信息
struct RepoInfo { path, head_branch, head_commit, is_bare, is_detached, state_summary }

// FileStatus: 单个文件状态
struct FileStatus { path, status: Status { WT_NEW, WT_MODIFIED, WT_DELETED, INDEX_NEW, INDEX_MODIFIED, INDEX_DELETED, CONFLICTED, RENAMED }, staged }

// CommitInfo: 提交摘要
struct CommitInfo { id, short_id, message, author, email, timestamp, parent_ids }

// CommitGraphData: DAG 图数据
struct CommitGraphData { nodes: Vec<GraphNode>, edges: Vec<GraphEdge> }
struct GraphNode { id, short_id, branch_labels, x, y, color }
struct GraphEdge { from, to }

// DiffResult: 文件差异
struct DiffResult { file_path, old_path, hunks: Vec<DiffHunk>, is_binary, is_too_large }
struct DiffHunk { old_start, old_lines, new_start, new_lines, lines: Vec<DiffLine> }
struct DiffLine { kind: Context|Addition|Deletion, content }

// BranchInfo: 分支信息
struct BranchInfo { name, is_head, is_remote, upstream, ahead, behind, last_commit }
```

---

## 性能策略

| 策略 | 实现方式 | 目标场景 |
|------|---------|---------|
| 分页加载提交历史 | 后端按 page/size 返回，前端滚动加载更多 | 大仓库（万级提交） |
| 按需加载 Diff | 点击文件时请求，非预加载全部 | 多文件变更 |
| 提交图分层渲染 | Canvas 只渲染可视区域 + 缩放平移 | DAG 可视化 |
| 仓库元数据缓存 | 内存缓存 HEAD、分支列表、状态摘要 | 避免重复计算 |
| 虚拟滚动文件列表 | 只渲染可视行 | 大量文件变更 |
| 大文件降级 | 超过阈值显示摘要不加载完整 Diff | 二进制/超大文件 |

---

## 开发规范

- **Git 分支策略**：`main`（稳定）← `dev`（开发）← `feature/*`（功能分支）
- **提交规范**：中文提交信息，格式 `类型: 描述`（如 `feat: 实现仓库打开命令`）
- **代码检查**：
  - 前端：`npx tsc --noEmit`（类型检查）+ 后续引入 ESLint
  - 后端：`cargo fmt` + `cargo clippy`
- **测试**：
  - Rust 单元测试：`cargo test`
  - 前端组件测试：后续引入 Vitest + solid-testing-library
  - 集成测试：后续引入 Tauri e2e 测试框架
- **接口优先**：新功能先定好 Tauri Command 的输入输出结构，再分头实现前后端
- **先可用再好看**：基础功能稳定后再优化动画和视觉细节

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `git2` 学习曲线 | 初期开发速度慢 | M1 预留充分时间，先跑通基本流程 |
| Canvas DAG 渲染复杂度 | M2 可能延期 | 先实现简单垂直列表，再迭代 Canvas |
| 跨平台差异（路径/换行） | 兼容性问题 | Rust 端统一处理，尽早多平台测试 |
| 大仓库性能 | 体验差 | 分页 + 缓存 + 按需加载从 M1 就引入 |

---

## 版本发布计划

| 版本 | 里程碑 | 预计功能 |
|------|--------|---------|
| v0.1.x | 当前 | 脚手架 + 基本 UI 框架 |
| v0.2.x | M1 | 仓库管理 + 暂存提交 + Diff |
| v0.3.x | M2 | DAG 提交树 + 分支管理 |
| v0.4.x | M3 | 远程同步 + 冲突 + Stash |
| v0.5.x | M4 | 性能优化 + 主题 + i18n |
| v1.0.0 | 正式版 | 全功能稳定发布 |
</parameter>