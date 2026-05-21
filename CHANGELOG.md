# Changelog / 已实现功能

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
