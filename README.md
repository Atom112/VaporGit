<div align="center">
  <img src="VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>基于 Tauri + SolidJS 的极致轻量跨平台 Git 桌面客户端</strong>
  </p>
  <p align="center">
    VaporGit 致力于打造轻量优雅的核心使用体验，为您带来优美、直观且高效的 Git 可视化管理。
  </p>

  <p align="center">
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white" alt="Tauri"></a>
    <a href="https://www.solidjs.com/"><img src="https://img.shields.io/badge/SolidJS-2C4F7C?logo=solid&logoColor=white" alt="SolidJS"></a>
    <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust"></a>
  </p>
</div>

<br/>

## ✨ 核心特性

我们的最终目标是提供比肩专业 Git 客户端（如 GitKraken）的功能矩阵，同时保持极夜般的轻巧。目前的焦点特性包含：

- **🌳 优美的交互式提交树 (DAG)**：支持多分支复杂逻辑的视觉渲染，清晰展现代码版本脉络。
- **🔍 直观高性能的 Diff 视图**：毫秒级的代码文件差异对比，支持行级精确高亮，阅码体验不妥协。
- **⚡ 极速与轻量 (Tauri+Rust)**：告别耗费数 GB 内存 的 Electron 容器，带来如系统原生般清爽丝滑的运行体验。
- **🛠 全场景 Git 工作流支持**：覆盖从暂存、提交、分支管理，到冲突解决、远程同步的日常全套基础操作。

---

## 🛠️ 构建与本地开发

VaporGit 利用现代 Web 与 Rust 混合架构，在开始之前，请确保您的开发环境齐备：

### 📌 环境要求

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable 版本
- **系统依赖**: 对于 Windows 用户，需具备 Microsoft C++ Build Tools 及 WebView2 Runtime。

### 🚀 快速启动开发

在终端中执行以下命令即可启动开发服：

```powershell
# 安装全部前端与项目依赖
npm install

# 仅启动前端开发服务器（Web视图，便于调试样式）
npm run dev

# 启动完整的 Tauri 桌面开发模式 (开启 Rust 监听构建)
npm run tauri dev
```

### 📦 生产构建生成

```powershell
# 1. 优先产出前端静态资源
npm run build

# 2. 构建发行版各平台安装包 (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 更多信息

以敏捷和整洁为优先原则，我们将完整的规划记录抽离，以便单独翻阅：

- **🏆 最新进展与日志**：请查看 [CHANGELOG.md](./CHANGELOG.md)。
- **🗺️ 项目里程碑与计划**：深入了解开发路线，请阅览 [doc/plan.md](./doc/plan.md)。

---

## 📝 License

本项目遵循仓库根目录的 `LICENSE` 协议。
