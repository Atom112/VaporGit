# Changelog / 已实现功能

## v1.0.5

### 应用内更新通知

**后端（Rust）：**
- `check_update`：启动时查询 GitHub Releases API，自动检测新版本
- 新增数据模型：`GitHubRelease`
- 版本号三段式逐段数值比较，正确处理 `1.0.9` → `1.0.10`
- 使用 GitHub 公开 API，无需登录即可检查更新（网络不可用时静默忽略）

**前端：**
- 启动时自动调用 `checkUpdate()` 检测新版本
- 发现新版本时通过 Toast 通知 `新版本 vX.X.X 已发布`

## v1.0.4

### 提交图渲染优化与 PR/分支管理增强

**后端（Rust）：**
- 重写 `get_commit_graph` 车道分配算法，修复多分支场景下节点 lane 错位问题
- 新增 `get_branch_list` 返回 ahead/behind 追踪信息、上游分支名
- `checkout_remote_branch` 支持自动创建本地追踪分支

**前端：**
- 提交图节点旁显示分支标签，无标签节点通过拓扑推断分支名
- 提交详情面板显示文件变更统计
- PR 列表支持全屏查看/评论 PR、创建 PR 弹窗
- 分支列表显示 ahead/behind 状态、上游分支
- 仓库列表缓存跨路由保持

## v1.0.3

### GitHub OAuth 集成 — 仓库浏览与 PR 管理

**后端（Rust）：**
- `github_login`：Tauri WebView 内嵌浏览器 PKCE 授权码流程
- `github_check_auth` / `github_logout` / `github_get_user`：认证状态管理
- `github_list_repos` / `github_get_repo`：仓库列表查询（分页）
- `github_list_branches`：仓库分支列表
- `github_list_pulls` / `github_get_pull` / `github_create_pull` / `github_merge_pull`：PR 完整 CRUD
- `github_get_pull_files` / `github_get_pull_diff` / `github_list_pull_comments` / `github_create_pull_comment`：PR 详情与审查
- Token 存入系统钥匙串 + 内存缓存，跨命令一致访问
- 新增数据模型：`GitHubUser`、`GitHubRepo`、`GitHubBranch`、`GitHubPullRequest`、`PRComment` 等

**前端：**
- GitHub 登录弹窗（`GitHubLogin.tsx`）：WebView 内嵌授权、自动关闭
- 用户菜单（`GitHubUserMenu.tsx`）：头像、用户名、退出登录
- 仓库列表（`GitHubRepoList.tsx`）：分页、搜索过滤、语言颜色标识、一键克隆
- PR 列表（`PRList.tsx`）：按状态筛选、查看/创建/合并 PR
- PR 详情（`PRDetail.tsx`）：文件变更、Diff 查看、评论列表与创建
- 创建 PR 弹窗（`PRCreateDialog.tsx`）：选择分支、填写标题描述
- `githubStore`：仓库缓存跨路由保持

## v1.0.2

### 修复与改进

**后端（Rust）：**
- 克隆时目标目录非空则自动创建子目录，避免克隆失败
- 失效仓库路径在打开时检测并提供清理能力

**前端：**
- 仓库列表中长路径截断显示，防止 UI 溢出
- Diff 视图跟随设置变更即时生效，无需刷新
- 失效仓库支持"从列表中移除"并添加删除动画
- Tailwind CSS 写法一致性改进
- 精简 README 核心特性介绍

## v1.0.1

### 版本管理

- 添加统一版本管理脚本 `npm run version -- <semver>`
- 自动更新 package.json / tauri.conf.json / Cargo.toml 并创建 git commit + tag
- CHANGELOG 与 README 更新

## v1.0.0

### M3：进阶协作版 — 远程同步 + 冲突处理 + 扩展功能

**后端（Rust）：**
- 远程操作：`fetch` / `pull` / `push` / `get_remotes` 命令，支持 SSH 凭证和默认凭证链
- 冲突处理：`get_conflicts` 检测索引冲突条目，`resolve_conflict` 支持 ours/theirs 策略
- Stash 完整操作：`stash_save` / `stash_list` / `stash_pop` / `stash_apply` / `stash_drop`
- Rebase：`rebase` 命令，基于 git2 rebase 操作，冲突检测和中止支持
- Cherry-pick：`cherry_pick` 命令，冲突检测，成功后自动提交
- 新增数据模型：`RemoteInfo`、`StashInfo`、`ConflictEntry`

**前端：**
- 远程同步面板：Repository 页面右侧顶部 Fetch/Pull/Push 按钮，带加载状态和 toast 通知
- Stash 管理面板（`StashPanel.tsx`）：Stash 列表 + 保存/应用/弹出/删除操作，模态框 UI
- 冲突解决弹窗（`ConflictResolver.tsx`）：自动检测冲突，ours/theirs 逐文件或批量解决
- Rebase/Cherry-pick 引导（`InteractiveRebase.tsx`）：选项卡式模态框，目标分支/提交输入
- 设置页面（`routes/Settings.tsx`）：diff 视图模式选择、默认远程名称配置
- `settingsStore`：localStorage 持久化用户偏好

### M2：图形增强版 — DAG 提交树 + 分支管理 + Diff 增强

**后端（Rust）：**
- `get_commit_graph`：返回 DAG 图数据（节点+边），多阶段车道分配布局算法，分支颜色编码
- `get_commit_detail`：提交完整信息（文件变更列表、新增/删除行数）
- `get_branch_list` / `create_branch` / `checkout_branch` / `delete_branch`：分支完整 CRUD
- 新增数据模型：`BranchInfo`、`CommitDetail`、`FileChange`、`CommitGraphData`、`GraphNode`、`GraphEdge`

**前端：**
- DAG 提交图（`CommitGraph.tsx`）：Canvas 渲染，多层绘制（边/贝塞尔曲线/节点/HEAD 金色环），离屏缓存优化
- 提交图交互：节点悬停信息卡、右键菜单（检出/创建分支/cherry-pick/复制 SHA）、车道分支提示、拖拽自动滚动
- 分支管理（`BranchList.tsx`）：分支列表 + 切换/创建/删除，ahead/behind 指示器
- 提交详情（`CommitDetail.tsx`）：元数据显示 + 文件变更列表 + 文件点击查看 Diff
- Diff 视图（`DiffView.tsx`）：支持 Unified / Split（左右分栏同步滚动）/ Full File 三种模式
- 语法高亮（`syntax.ts`）：基于 highlight.js，支持 80+ 文件类型
- 可拖动分隔条调整左右面板宽度

### M1：可用的基础版 — 仓库管理 + 暂存提交 + Diff

**后端（Rust）：**
- 集成 `git2` crate，`tokio::task::spawn_blocking` 异步封装所有 Git 操作
- `open_repo`：打开本地仓库，返回基本信息（HEAD、分支、状态摘要）
- `get_recent_repos` / `save_repo_path`：最近仓库持久化（JSON 文件，上限 10 条）
- `get_status`：工作区文件状态列表，支持 7 种状态（WT_NEW/MODIFIED/DELETED、INDEX_NEW/MODIFIED/DELETED、CONFLICTED）
- `stage_files` / `unstage_files`：暂存/取消暂存
- `commit`：创建提交
- `get_commit_history`：分页查询提交历史（Revwalk TIME 排序）
- `get_file_diff`：文件差异比较，支持工作区 vs HEAD、提交间对比、二进制/大文件检测（1MB 截断）
- `clone_repo`：远程克隆仓库
- `get_file_content`：获取文件内容（指定提交或 HEAD）
- 数据模型：`RepoInfo`、`RecentRepo`、`FileStatus`、`StatusKind`、`CommitInfo`、`DiffResult`、`DiffHunk`、`DiffLine`、`DiffLineKind`

**前端：**
- Tauri invoke 类型安全封装（`tauriCommands.ts`）
- TypeScript 类型定义（`types.ts`），与 Rust 模型对应
- `repoStore`：仓库路径、HEAD、状态管理
- `diffStore`：文件列表、Diff 内容、视图模式
- `toastStore`：通知消息系统
- 主页（`Home.tsx`）：打开仓库 + 最近仓库列表
- 仓库页布局（`Repository.tsx`）：左侧文件列表 + 右侧 Diff 面板
- 文件列表（`FileList.tsx`）：文件树，状态图标，暂存/取消暂存操作
- Diff 视图（`DiffView.tsx`）：Unified 模式行级高亮，行号，颜色编码
- 状态栏（`StatusBar.tsx`）：当前分支、HEAD、工作区状态
- 提交工作流：消息输入 + 提交按钮

### 脚手架阶段

- 使用官方脚手架完成 Tauri + SolidJS(TypeScript) 初始化
- 项目结构：前端 `src` + 后端 `src-tauri`
- 自定义标题栏（最小化/最大化/关闭 + 拖拽区域）
- 导航栏（主页/仓库/设置路由）
- 前端路由：`/`、`/repository`、`/settings`
- 页面过渡动画组件
- Tailwind CSS v4 集成
