<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Tauri + SolidJS をベースにした超軽量クロスプラットフォーム Git デスクトップクライアント</strong>
  </p>
  <p align="center">
    VaporGit は、軽量でエレガントなコア体験を提供することに重点を置いており、美しく直感的で効率的な Git ビジュアル管理を実現します。
  </p>

  <p align="center">
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white" alt="Tauri"></a>
    <a href="https://www.solidjs.com/"><img src="https://img.shields.io/badge/SolidJS-2C4F7C?logo=solid&logoColor=white" alt="SolidJS"></a>
    <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust"></a>
  </p>
  <p align="center">
    <a href="../README.md">English</a> ·
    <a href="./README.zh-CN.md">简体中文</a> ·
    <a href="./README.zh-TW.md">繁體中文</a> ·
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

## ✨ 主な機能

- **🌳 美しいインタラクティブコミットグラフ (DAG)**：マルチブランチの複雑なロジックを視覚的にレンダリングし、バージョン履歴を明確に表示します。
- **🔍 高性能 Diff ビューア**：ミリ秒単位のファイル差分比較、行レベルのシンタックスハイライトに対応。
- **⚡ 超高速＆軽量 (Tauri+Rust)**：Electron の GB 単位のメモリ消費から解放され、ネイティブのようなスムーズな体験を提供します。
- **🛠 完全な Git ワークフロー対応**：ステージング、コミット、ブランチ管理、コンフリクト解決、リモート同期まで、日常の操作をすべてカバー。

---

## 📥 ダウンロード

[GitHub Releases](https://github.com/Atom112/VaporGit/releases) ページから各プラットフォーム向けの最新インストーラをダウンロードできます。ローカルでのビルドは不要です。

| プラットフォーム | パッケージ形式 | 備考 |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | ダブルクリックでインストール。WebView2 Runtime が必要です。 |
| **macOS** | `.dmg` | 開いて VaporGit を Applications フォルダにドラッグ。 |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` は Debian/Ubuntu 系、`.rpm` は Fedora/RHEL 系、`.AppImage` は汎用形式 — `chmod +x` して実行。 |

---

## 🛠️ ビルドと開発

VaporGit はモダンな Web 技術と Rust のハイブリッドアーキテクチャを採用しています。始める前に開発環境を整えてください。

### 📌 前提条件

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable チャンネル
- **システム依存関係**: Windows ユーザーは Microsoft C++ Build Tools と WebView2 Runtime が必要です。

### 🚀 クイックスタート

```powershell
# フロントエンドとプロジェクトの依存関係をインストール
npm install

# フロントエンド開発サーバーのみ起動（スタイリングやUI作業用）
npm run dev

# Tauri デスクトップ開発モードを起動（Rust ホットリロード付き）
npm run tauri dev
```

### 📦 プロダクションビルド

```powershell
# フロントエンドの静的アセットをビルド
npm run build

# プラットフォーム固有のインストーラをビルド（macOS .dmg / Windows .msi / Linux .AppImage）
npm run tauri build
```

---

## 📚 詳細情報

- **🏆 変更履歴**: [CHANGELOG.md](../CHANGELOG.md) を参照してください。
- **🗺️ ロードマップ**: [doc/plan.md](../doc/plan.md) を参照してください。

---

## 📝 ライセンス

このプロジェクトは、リポジトリルートの `LICENSE` ファイルの条項に基づいてライセンスされています。