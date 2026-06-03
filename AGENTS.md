# VaporGit — Agent Workflow Reference

> 本文档为 AI Agent（Claude Code 等）在此项目中的工作流程提供标准化指引。
> 目标：确保 Agent 按照固定边界和流程处理任务，减少遗漏和偏差。

---

## 工作流程总览

```
需求边界确定 → 工程代码编写 → 代码安全性审查 → Git提交与Push → 询问版本发布
```

---

## 一、需求边界确定

### 1.1 收到需求后第一步

- 阅读 `AGENTS.md`（本文件）了解流程
- 阅读 `CLAUDE.md`（如存在）了解项目结构和约定
- 阅读 `package.json` 和 `src-tauri/Cargo.toml` 了解版本号
- 如果需求涉及具体代码，先 `git status` 确认当前分支和工作区状态

### 1.2 需求分类

判断需求属于以下哪一类：

| 类别 | 示例 | 处理方式 |
|------|------|---------|
| **Bug 修复** | 功能不工作、崩溃、数据错误 | 复现 → 定位根因 → 最小修复 |
| **功能开发** | 新UI、新git操作、新平台集成 | 架构设计 → 逐步实现 |
| **代码审查** | 安全审计、质量审查 | 按审查清单逐项检查 |
| **重构/优化** | 性能优化、代码清理 | 确定范围 → 逐步更改 |
| **配置/构建** | CI/CD、打包、发布 | 按构建流程处理 |

### 1.3 边界确认

在开始编码前必须确认：

- [ ] 需求是否明确？模糊处是否已提问澄清？
- [ ] 是否已理解该需求对 Rust 后端 / TypeScript 前端 / 构建配置的影响范围？
- [ ] 是否有现成的函数/组件可以复用而不是重新实现？
- [ ] 改动是否会破坏现有功能？是否需要新增测试或手动验证？

### 1.4 复杂任务的处理原则

对于多步骤的复杂任务，先将任务拆分为可独立验证的子任务。每个子任务完成后同步进展。

---

## 二、工程代码编写

### 2.1 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | SolidJS（_不是 React_） + TypeScript |
| 路由 | `@solidjs/router` |
| 状态管理 | `solid-js` 的 `createStore`（无 Redux/Context） |
| 样式 | Tailwind CSS v4 |
| 语法高亮 | highlight.js |
| 终端 | xterm.js |
| 桌面框架 | Tauri 2 |
| 后端语言 | Rust（edition 2021） |
| Git 操作 | `git2` crate（libgit2 绑定） |
| HTTP 客户端 | `reqwest` |
| OAuth | PKCE 授权码流程（内嵌 WebView） |
| 构建 | Vite（前端）+ Cargo（后端） |
| 国际化 | 自建 i18n 系统（`src/i18n/`），key 前缀匹配 |

### 2.2 架构约定

**后端模块结构（`src-tauri/src/`）：**
```
git/          git 操作实现（repo, commit, branch, remote, status, stash, diff, tag, validate）
commands/     Tauri 命令桥接层（repo, commit, branch, remote, diff, stash, tag, terminal, github, gitee）
models/       数据结构定义
github/       GitHub API 集成（auth, api, pulls, repos, update）
gitee/        Gitee API 集成（auth, api, pulls, repos）
oauth/        通用 OAuth 流程（flow, token）
```

**前端模块结构（`src/`）：**
```
routes/        页面组件（Home, Repository, Settings, GitHubPRs, GiteePRs）
components/    可复用组件（git/, github/, gitee/, ui/, layout/, terminal/, tutorial/）
stores/        SolidJS 状态仓库
lib/           工具函数（tauriCommands.ts, types.ts, gitErrorDesc.ts, diffParser.ts, syntax.ts）
i18n/          国际化翻译文件
```

### 2.3 编码规则

#### Rust 后端

- **错误处理**：所有函数返回 `Result<T, String>`，错误消息使用**中文**（与项目现有风格一致）
- **Tauri 命令**：在 `commands/` 下添加，在 `lib.rs` 中的 `invoke_handler` 注册
- **git2 操作**：必须在 `tokio::task::spawn_blocking` 中执行（git2 是同步的）
- **输入验证**：用户输入的路径、分支名、标签名必须验证合法性（使用 `git::validate` 模块）
- **Token 鉴权**：HTTPS 操作在凭据回调中按 host 加载对应 token，不嵌入 git config
- **文件路径**：用户提供的路径必须验证在 repo workdir 内（`validate_path_in_workdir`）

#### TypeScript 前端

- **状态管理**：使用 `createStore`，不使用 `useState` 或 Context
- **Tauri 调用**：全部通过 `src/lib/tauriCommands.ts` 封装，不直接 `invoke()`
- **错误展示**：用户可见的错误必须用 `describeError()` 包装；`catch` 块不能为空
- **i18n**：用户可见文本使用 `tt()`（简单）或 `ttf()`（函数值），不硬编码
- **加载状态**：异步操作必须有对应的 loading/disabled 状态防止重复提交
- **空/错误状态**：组件必须覆盖 loading、empty、error、正常四种状态

### 2.4 常见陷阱

- **undo 是 `git reset --soft`**：不是真正撤销，只移动 HEAD
- **redo 读取 reflog**：依赖 reflog 条目顺序，两次 undo 间有其他操作会错乱
- **fetch 不支持某些 URL**：`extract_host()` 函数处理 HTTPS 和 SSH URL
- **CSP 配置**：`tauri.conf.json` 中 `security.csp` 已配置，不可改为 `null`
- **`describeError` 正则**：只匹配 `HTTP 4xx/5xx` 或 `status code 4xx/5xx` 模式

---

## 三、代码安全性审查

每次提交前必须执行以下安全检查（也适用于独立的代码审查任务）：

### 3.1 审查清单

#### 路径与文件操作
- [ ] `fs::remove_dir_all` / `fs::remove_file` 操作前是否验证路径在 workdir 内？
- [ ] 用户输入的路径是否使用了 `validate_path_in_workdir()`？
- [ ] 相对路径是否可能包含 `..` 导致目录遍历？

#### 用户输入（S5）
- [ ] 分支名、标签名是否使用了 `validate_ref_name()`？
- [ ] commit message 是否检查了空值？
- [ ] clone URL 是否有格式验证？（目前前端只做了 trim）

#### Token 与凭据（S2, S3, S4）
- [ ] 新加的远程操作是否加载了对应平台的 token？
- [ ] token 是否存储在 `oauth/token.rs` 的 TokenStore 中？
- [ ] token 文件是否通过 `write_secure_file()` 写入（权限 `0600`）？
- [ ] OAuth client_id/client_secret 是否有 env var 覆盖机制？

#### CSP（S1）
- [ ] 新功能是否引入了外部资源加载（CDN 脚本、字体、图片）？如有，需更新 CSP

#### 错误处理
- [ ] `catch` 块是否至少用 `addToast` 或 `console.error` 记录错误？
- [ ] 用户看到的错误是否经过 `describeError()` 处理？没有裸 `String(e)`？
- [ ] 所有 Tauri 命令的结果是否被处理（loading 状态重置、错误提示）？

#### 并发安全
- [ ] 是否在 `spawn_blocking` 中执行了同步操作？
- [ ] 是否有竞态条件可能导致文件系统不一致？

### 3.2 审查后动作

- 发现安全问题 → 修复后再提交
- 发现严重问题（路径遍历、Token 泄露、任意代码执行）→ 立即报告开发者

---

## 四、Git 提交与 Push

### 4.1 分支策略

- **主分支**：`main`（只合并不直接提交）
- **开发分支**：当前工作分支（由开发者指定）
- **工作流程**：
  ```bash
  git checkout -b feature/xxx   # 新功能分支
  git checkout -b fix/xxx       # 修复分支
  ```

### 4.2 🔴 Git 操作禁令（严格遵守）

以下操作**绝对禁止**，Agent 在任何情况下不得执行：

| 禁止的操作 | 原因 | 安全替代方案 |
|-----------|------|------------|
| `git push --force` / `git push -f` | 覆盖远程历史，导致协作者丢失提交 | 改用 `git revert` 撤销已推送的提交 |
| `git push --force-with-lease` | 同上，即使有安全检查也禁止 | 同上 |
| `git reset --hard HEAD~n` | 永久丢弃本地更改和提交 | 用 `git reset --soft` 保留更改，或 `git stash` 暂存 |
| `git commit --amend` | 改写已存在的提交，对已推送分支造成历史分歧 | 用新提交追加更改 |
| `git checkout -- .` | 批量丢弃工作区所有更改，不可恢复 | 逐个文件 `git checkout -- <file>` |
| `git clean -fd` / `git clean -fdx` | 批量删除未跟踪文件/目录，不可恢复 | 逐个文件手动确认 |
| `git branch -D`（大写 D） | 强制删除未合并的分支，丢失提交 | 用 `git branch -d`（仅当已合并时可用） |
| `git rebase --onto` / `git rebase` **在共享分支上** | 改写已推送的历史，导致协作者混乱 | 只在私有/本地分支上使用 rebase |

### 4.3 ⚠️ 需开发者明确批准的操作

以下操作必须先**询问开发者**，获得批准后方可执行：

| 操作 | 询问方式 |
|------|---------|
| `git reset --soft`（本地撤销） | "需要撤销最近一次提交吗？这只会移动 HEAD，更改保留在暂存区。" |
| `git rebase`（私有分支） | "需要在此私有分支上执行变基吗？确认没有其他人基于此分支工作。" |
| `git push --delete origin <branch>` | "需要删除远程分支 `<branch>` 吗？" |
| `git revert <commit>`（撤销已推送提交） | "需要 revert 提交 `<sha>` 吗？这会创建一个新的撤销提交。" |
| `git rm -r <dir>` | "需要删除整个目录 `<dir>` 并记录到索引吗？" |
| 创建或切换分支 | 在 `main` 上直接操作前确认："要在哪个分支上工作？" |

### 4.4 安全操作指引

- **想撤销本地的最近一次提交** → `git reset --soft HEAD~1`（更改保留在暂存区）
- **想撤销已推送到远程的提交** → `git revert <commit>`（创建新的撤销提交，不修改历史）
- **想丢弃单个文件的更改** → `git checkout -- <file>`
- **想暂存当前工作区** → `git stash push -m "描述"`
- **想放弃所有本地更改回到干净状态** → 先 `git stash` 暂存，再决定是否丢弃

### 4.5 提交规范

提交信息格式：
```
<type>: <简短描述>

<可选详细说明>
```

| type | 适用场景 |
|------|---------|
| feat | 新功能 |
| fix | Bug 修复 |
| security | 安全修复 |
| refactor | 重构 |
| perf | 性能优化 |
| i18n | 国际化相关 |
| chore | 构建/配置/版本 |

提交要求：
- 每个提交**只做一件事**，粒度适中
- 提交信息描述**为什么和做什么**，而非怎么做
- 涉及安全性修复时在正文说明影响

**提交信息尾注**（自动添加）：
```
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>
```

### 4.6 Push 前检查

- [ ] `cargo check` 通过（Rust 后端）
- [ ] `npx tsc --noEmit` 通过（TypeScript 类型检查，可选）
- [ ] `npx vite build` 通过（前端构建）
- [ ] 安全性审查清单已检查
- [ ] **确认本次 push 不包含上述禁止操作**（4.2 节）
- [ ] 确认当前不在 `main` 分支上（除非开发者明确要求）

### 4.7 Push

```bash
git add <files>
git commit -m "<type>: <message>"
git push origin <branch>        # 普通 push，不加任何 --force 标志
```

---

## 五、版本发布流程

### 5.1 版本号规范

遵循语义化版本 `MAJOR.MINOR.PATCH`：
- **MAJOR**: 不兼容的 API 修改
- **MINOR**: 向下兼容的功能新增
- **PATCH**: 向下兼容的问题修复

### 5.2 发布流程

完成所有开发工作并合并到 `main` 后：

1. **询问开发者**：`是否需要使用 GitHub Actions 构建下一版本发布？`

2. **如果开发者确认发布，执行以下步骤**：

   a. **确定版本号**：询问开发者新版本号（如 `1.3.0`），或根据 commits 按语义化版本推算

   b. **编写 / 更新 CHANGELOG.md**：
      - 在项目根目录创建或更新 `CHANGELOG.md`
      - 格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)：
        ```markdown
        # Changelog

        ## [1.3.0] - 2026-05-31

        ### Added
        - 新功能 A
        - 新功能 B

        ### Fixed
        - Bug 修复 X
        - Bug 修复 Y

        ### Security
        - 安全修复 S（CSP 配置、输入验证等）

        ### Changed
        - 重构模块 M
        ```
      - 对照本次发布以来的所有 commits，按 type 分类整理变更：
        - `feat` → `### Added`
        - `fix` → `### Fixed`
        - `security` → `### Security`
        - `refactor` / `perf` → `### Changed`
        - `i18n` → `### Changed`
        - `chore` → 通常是内部改动，无需在 changelog 中列出
      - 安全性修复**必须**单独列在 `### Security` 章节
      - 如果 `CHANGELOG.md` 已存在，在文件头部**插入**新版本条目（保留旧版本历史）
      - 提交 CHANGELOG：`git add CHANGELOG.md && git commit -m "docs: add changelog for v<新版本号>"`

   c. **升级版本**：
      ```bash
      npm run version -- <新版本号>
      # 这会自动:
      # - 更新 package.json 版本
      # - 更新 tauri.conf.json 版本
      # - 更新 Cargo.toml 版本
      # - 创建 git commit "chore: bump version to v<新版本号>"
      # - 创建 git tag v<新版本号>
      ```

   d. **推送标签**（触发 GitHub Actions 构建）：
      ```bash
      git push origin main
      git push origin v<新版本号>
      ```

   e. **GitHub Actions 自动执行**：
      - workflow 文件：`.github/workflows/release.yml`
      - 触发条件：推送 `v*` 标签
      - 构建产物：Windows（msi）、macOS（dmg）、Linux（deb/rpm/AppImage）
      - 发布方式：自动创建 GitHub Release（非草案、非预发布）
      - 注意：Release body 由 workflow 自动生成，如需修改请到 GitHub Releases 页面手动编辑

   f. **告知开发者**：GitHub Actions 已触发，构建完成后可在 Releases 页面下载

3. **如果开发者不确认发布**，则结束流程。

### 5.3 关于 GitHub Actions 的注意事项

- 使用 `tauri-apps/tauri-action@v0`（版本较旧，如遇到问题建议升级到 `@v2`）
- 构建在 ubuntu-22.04、macos-latest、windows-latest 上运行
- 需要 `GITHUB_TOKEN` 自动注入（GitHub 自动提供）
- 发布为正式版（`releaseDraft: false`, `prerelease: false`）

---

## 六、其他可能流程

### 6.1 国际化（i18n）扩充

当添加用户可见文本时：

1. 在 `src/i18n/en.ts` 中添加英文 key
2. 在 `src/i18n/zh.ts` 中添加中文翻译
3. 建议同步更新其他语言（zh-TW、ja、ko、fr、de 等），至少添加 key 骨架
4. 前端代码中使用 `tt('section.key')` 或 `ttf('section.key', arg)` 引用

### 6.2 Tauri 命令注册流程

添加新的后端命令给前端调用：

1. 在 `commands/` 下对应模块添加函数（`#[tauri::command]`）
2. 在 `lib.rs` 的 `invoke_handler` 中注册
3. 在 `src/lib/tauriCommands.ts` 中添加 TypeScript 包装函数
4. 在需要的组件中 import 并使用

### 6.3 Git 操作添加流程

添加新的 git 操作：

1. 在 `git/` 下对应模块实现核心逻辑
2. 在 `commands/` 下创建 Tauri 命令桥接
3. 如果有新的模型数据结构，在 `models/` 下添加
4. 在 `lib.rs` 注册命令
5. 在 `tauriCommands.ts` 中添加包装
6. 如果操作涉及凭据，确保使用 token 和 `extract_host()`

### 6.4 代码审查流程

当收到"审查代码"请求时（与此文件第3节独立）：

1. 阅读完整审查报告（如已存在）或从头审查
2. 按维度检查：安全性 → 业务逻辑 → 潜在 Bug → 错误提示
3. 审查结果记录为结构化的 Markdown 报告
4. 提交开发者审核，审核通过后逐项修复

---

## 七、快速参考

### 常用命令

```bash
# 后端检查
cd src-tauri && cargo check

# 前端构建
npm run build

# 版本升级
npm run version -- 1.2.3

# 开发服务器
npm run dev
```

### 关键文件索引

| 文件 | 用途 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri 命令注册中心 |
| `src-tauri/src/git/remote.rs` | 远程操作（fetch/push/pull）+ Token 鉴权 |
| `src-tauri/src/git/status.rs` | 文件状态、暂存、冲突解决、路径验证 |
| `src-tauri/src/git/commit.rs` | 提交、变基、cherry-pick、undo/redo |
| `src-tauri/src/git/validate.rs` | 输入验证函数 |
| `src-tauri/src/oauth/token.rs` | Token 存储（内存 + 密钥链 + 文件） |
| `src/lib/tauriCommands.ts` | 所有前端 Tauri 命令包装 |
| `src/lib/gitErrorDesc.ts` | 错误消息翻译函数 |
| `src/i18n/en.ts` | 英文国际化 |
| `src/routes/Repository.tsx` | 主工作区页面 |
| `src-tauri/tauri.conf.json` | Tauri 配置（含 CSP） |
| `CHANGELOG.md` | 版本变更日志（发布前由 Agent 更新） |
| `.github/workflows/release.yml` | 版本发布构建 |
| `scripts/bump-version.mjs` | 版本号升级脚本 |

---

*本文档由 Agent 维护，随项目演进更新。*
