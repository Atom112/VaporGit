<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>基於 Tauri + SolidJS 的極致輕量跨平台 Git 桌面用戶端</strong>
  </p>
  <p align="center">
    VaporGit 致力於打造輕量優雅的核心使用體驗，為您帶來美觀、直觀且高效的 Git 可視化管理。
  </p>

  <p align="center">
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white" alt="Tauri"></a>
    <a href="https://www.solidjs.com/"><img src="https://img.shields.io/badge/SolidJS-2C4F7C?logo=solid&logoColor=white" alt="SolidJS"></a>
    <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust"></a>
  </p>
  <p align="center">
    <a href="../README.md">English</a> ·
    <a href="./README.zh-CN.md">简体中文</a> ·
    <a href="./README.ja.md">日本語</a> ·
    <a href="./README.ko.md">한국어</a> ·
    <a href="./README.fr.md">Français</a> ·
    <a href="./README.de.md">Deutsch</a> ·
    <a href="./README.ar.md">العربية</a> ·
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ 核心特性

- **🌳 優美的互動式提交樹 (DAG)**：支援多分支複雜邏輯的視覺渲染，清晰展現程式碼版本脈絡。
- **🔍 直觀高效能的 Diff 檢視**：毫秒級的程式碼檔案差異比對，支援行級精確高亮，閱碼體驗不妥協。
- **⚡ 極速與輕量 (Tauri+Rust)**：告別耗費數 GB 記憶體的 Electron 容器，帶來如系統原生般清爽流暢的執行體驗。
- **🛠 全場景 Git 工作流程支援**：覆蓋從暫存、提交、分支管理，到衝突解決、遠端同步的日常全套基礎操作。

---

## 📥 下載安裝

從 [GitHub Releases](https://github.com/Atom112/VaporGit/releases) 頁面可直接下載各平台的最新安裝包，無需本地構建。

| 平台 | 安裝包格式 | 說明 |
|------|-----------|------|
| **Windows** | `.msi` / `.exe` | 雙擊安裝即可使用，依賴系統 WebView2 Runtime |
| **macOS** | `.dmg` | 開啟後將 VaporGit 拖入 Applications 資料夾 |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` 適用於 Debian/Ubuntu 系；`.rpm` 適用於 RedHat 系；`.AppImage` 通用格式，下載後 `chmod +x` 即可執行 |

---

## 🛠️ 構建與本地開發

VaporGit 利用現代 Web 與 Rust 混合架構，在開始之前，請確保您的開發環境齊備：

### 📌 環境要求

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable 版本
- **系統依賴**: 對於 Windows 使用者，需具備 Microsoft C++ Build Tools 及 WebView2 Runtime。

### 🚀 快速啟動開發

在終端機中執行以下命令即可啟動開發伺服器：

```powershell
# 安裝全部前端與專案依賴
npm install

# 僅啟動前端開發伺服器（Web 檢視，便於除錯樣式）
npm run dev

# 啟動完整的 Tauri 桌面開發模式（開啟 Rust 監聽構建）
npm run tauri dev
```

### 📦 生產構建產生

```powershell
# 1. 優先產出前端靜態資源
npm run build

# 2. 構建發行版各平台安裝包 (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 更多資訊

以敏捷和整潔為優先原則，我們將完整的規劃記錄抽離，以便單獨查閱：

- **🏆 最新進展與日誌**：請查看 [CHANGELOG.md](../CHANGELOG.md)。
- **🗺️ 專案里程碑與計畫**：深入了解開發路線，請查閱 [doc/plan.md](../doc/plan.md)。

---

## 📝 License

本專案遵循倉庫根目錄的 `LICENSE` 協議。