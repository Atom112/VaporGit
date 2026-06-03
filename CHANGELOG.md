# Changelog / 已实现功能

## v1.2.2 - 2026-05-31

### Security
- 修复 CSP 安全策略完全关闭问题：设置最小权限 CSP（`default-src 'self'`），防止 XSS 攻击
- OAuth 客户端凭据支持通过环境变量覆盖（`VAPORGIT_GITHUB_CLIENT_ID` / `VAPORGIT_GITEE_CLIENT_ID`），降低源码凭据泄露风险
- Token 文件存储添加权限限制（Unix `0600`），防止其他用户读取 OAuth token
- 新增 `git/validate.rs` 输入验证模块：分支名/标签名使用 `validate_ref_name()` 校验，防止注入
- 修复 `discard_files` 路径遍历漏洞：用户提供路径需在 repo workdir 内，拒绝 `..` 和绝对路径
- 修复 `discard_files` 递归删除目录风险：改为拒绝目录删除，防止数据丢失

### Fixed
- 修复 `fetch` 不支持 HTTPS Token 鉴权：为 `fetch()` 添加 GitHub/Gitee token 加载，与 `push` 一致
- 修复 `pull` 快进合并硬编码 `refs/heads/main` 回退：改为检测当前 HEAD 分支名
- 修复 `redo` 创建内容不同的提交：改用 reflog 原始 OID 恢复原提交的树，确保 `redo` 精确还原
- 修复远程删除分支只支持 GitHub token：添加 Gitee token 支持
- 修复 Token 选择用 `url.contains()` 判断不准确：新增 `extract_host()` 函数正确解析 HTTPS/SSH URL
- 修复 cherry-pick/revert 提交消息缺乏标准格式：添加原始提交 SHA 引用
- 变基冲突时收集冲突文件列表返回给用户，提供更清晰的提示

### Changed
- `describeError()` 正则改为只匹配 `HTTP 4xx/5xx` 前缀，避免误匹配
- `describeError()` 返回纯翻译文本而非英文原文 + 翻译的混合格式
- Pull 结果消息统一为中文（"已经是最新的"、"快进合并完成"、"合并完成"）
- ProviderConfig 的 `client_id` / `client_secret` 从 `&'static str` 改为 `String` 类型，支持运行时动态赋值

### Added
- 为所有静默失败的 catch 块添加 Toast 用户通知（refreshStatus、handleToggleStage、handleSelectFile 等）
- 9 处原始 `String(e)` 错误改为 `describeError()` 包装 + i18n key
- 新增 18 个 i18n key（en.ts / zh.ts）

## v1.2.1 - 2026-05-30

### Fixed
- 修复文件 diff 显示页面无法滚动的问题

## v1.2.0 - 2026-05-28

### Added
- 新手引导教程（`TutorialOverlay.tsx`）
- 首次运行欢迎弹窗
- 9 步交互式功能引导（仓库打开、远程操作、提交、文件状态、提交图等）
- 演示仓库自动创建与清理

### Changed
- UI 优化：页面布局、颜色系统、动画效果改进

## v1.1.7 - 2026-05-28

### Added
- 为 Gitee 平台添加 PR 管理功能（列表、详情、创建、合并）（`GiteePRList.tsx`、`GiteePRDetail.tsx`、`GiteePRCreateDialog.tsx`）

## v1.1.6 - 2026-05-28

### Changed
- 清理安装包美化文件
- 错误信息明晰化

## v1.1.5 - 2026-05-26

### Fixed
- 使用 `git2::Diff API` 进行重命名检测，仿照 GitKraken 逻辑，替代 basename 启发式算法

## v1.1.4 - 2026-05-25

### Added
- 设置页面添加"检查更新"手动触发按钮

### Fixed
- 使用已验证的 GitHub API 进行更新检查，避免未登录时的速率限制问题
- GitHub Actions 发布 workflow 改为自动发布（非草案）
- 更新检查使用 GitHub 认证 API 以避免匿名限流

## v1.1.3 - 2026-05-25

### Added
- 主题切换：支持 Dark / Light / System 三种模式
- Tailwind CSS v4 升级
- Node.js 升级到 26

### Fixed
- PR merge UI 改进与 i18n 修复

## v1.1.2 - 2026-05-24

### Added
- 文件列表添加"暂存全部"和"取消暂存全部"按钮
- README.en.md 英文版本文档

### Changed
- Toast 通知添加退出动画

## v1.1.0 - 2026-05-24

### Added
- 内置终端功能（`TerminalPanel.tsx`）：基于 xterm.js + Rust PTY，支持 PowerShell/cmd/bash/zsh
- M5 阶段功能：进阶协作能力

### Fixed
- 提交图 PR 节点提前问题修复
- 提交树渲染修复

## v1.0.9 - 2026-05-24

### Added
- 启动画面（Splash Screen）：应用启动时显示品牌动画
- 目录结构变更检测逻辑

---

## v1.0.8

### 修复

**前端：**
- 修复更新通知确认下载和忽略按钮不显示的问题：`onMount` 在异步 `checkUpdate()` 完成前已执行，导致 `asset` 始终为空；改用 `createEffect` 响应式监听 `release` 变更后自动解析 asset

## v1.0.7

### 自动下载更新 & 一键升级

**后端（Rust）：**
- `github_get_asset`：从 GitHub Release 资源中自动匹配当前平台安装包（Windows → .msi, macOS → .dmg, Linux → 运行时检测 dpkg/rpm 选择 .deb/.rpm，回退 .AppImage）
- `github_start_download`：流式下载安装包，每 256KB 通过 Tauri Event 发送下载进度
- `github_install_update`：下载完成后启动安装器（Windows: msiexec 原地升级，macOS: open, Linux: pkexec dpkg/rpm），500ms 后自动退出应用
- `update` 模块：统一封装平台匹配、进度下载、安装启动逻辑
- 新增数据模型：`GitHubReleaseAsset`

**前端：**
- 更新通知增加下载进度条（实时显示已下载/总大小）
- 下载完成后显示"安装更新"按钮，点击后启动安装器并退出应用
- `updateStore` 新增四阶段状态管理：idle → downloading → downloaded → installing

### Token 持久化可靠性改进

**后端（Rust）：**
- `save_token` / `load_token` / `clear_token`：在原有钥匙串（keyring）基础上增加 `%APPDATA%/VaporGit/github_token` 文件持久化
- `load_token` 读取顺序：内存缓存 → 钥匙串 → 文件，取到即止
- 解决部分 Windows 环境下 keyring 凭据无法跨会话保持的问题

### 更新通知 UI 优化

**前端：**
- 通知位置移至左下角，琥珀色样式
- 新增"确认下载"按钮（打开 GitHub Releases 页面）和"忽略"按钮
- 通知不会自动消失，需用户明确操作

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
