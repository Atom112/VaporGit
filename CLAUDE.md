# Claude Code — Project Rules

Start every session by reading `AGENTS.md` for the full workflow reference.
This file contains the essential rules that must be followed at all times.

## Critical Startup Steps

1. **Read `AGENTS.md`** — full workflow rules before any task
2. **Read `package.json` and `src-tauri/Cargo.toml`** — confirm current version
3. **Run `git status`** — confirm current branch and working tree state
4. See also: `.claude/settings.local.json` for project-specific Claude Code settings

## Security Review (Mandatory Before Commit)

Check all items in AGENTS.md §3 before every commit:
- Path traversal? `validate_path_in_workdir()` used?
- User input validated with `validate_ref_name()`?
- Token loaded for new remote operations?
- `catch` blocks never empty, `describeError()` used?
- All Tauri commands in `spawn_blocking`?
- CSP not nullified?

## Git Rules

### 🔴 NEVER (automatic denial)
- `git push --force` / `--force-with-lease`
- `git reset --hard`
- `git commit --amend`
- `git clean -fd`
- `git branch -D`
- `git rebase` on shared branches

### ⚠️ ALWAYS ask developer first
- `git reset --soft`
- `git rebase` (private branches only)
- `git push --delete origin <branch>`
- `git revert <commit>`
- Creating/switching to `main`

### ✅ Safe workflow
```bash
git add <files>
git commit -m "<type>: <message>"
git push origin <branch>
```

## Version Bump

Use the script, never do it manually:
```bash
npm run version -- <semver>
# This auto-updates: package.json, tauri.conf.json, Cargo.toml
# Then creates: git commit + git tag
```

## Coding Essentials

| Area | Rule |
|------|------|
| Rust errors | Chinese string messages, `Result<T, String>` |
| Rust async | `git2` ops in `tokio::task::spawn_blocking` |
| Commands | Register in `commands/*.rs` → `lib.rs` → `tauriCommands.ts` |
| UI text | `tt('key')` / `ttf('key', arg)` — never hardcode Chinese/English |
| Async states | Always cover: loading, empty, error, success |
| State management | `createStore`, not `useState` / Context |
| Error display | `describeError()` wraps user-facing errors |

## Release Workflow

See AGENTS.md §5 for full release process. Key steps:
1. Ask developer: "需要发布新版本吗？"
2. Wait for confirmation
3. Run `npm run version -- <version>` (auto commits + tags)
4. Push: `git push origin <branch> && git push origin v<version>`
5. Tell developer: "GitHub Actions 已触发"
