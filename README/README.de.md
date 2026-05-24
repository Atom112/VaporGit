<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Ein extrem leichtgewichtiger, plattformübergreifender Git-Desktop-Client basierend auf Tauri + SolidJS</strong>
  </p>
  <p align="center">
    VaporGit konzentriert sich auf eine leichte und elegante Kernnutzererfahrung — schöne, intuitive und effiziente visuelle Git-Verwaltung.
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
    <a href="./README.ja.md">日本語</a> ·
    <a href="./README.ko.md">한국어</a> ·
    <a href="./README.fr.md">Français</a> ·
    <a href="./README.ar.md">العربية</a> ·
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ Hauptfunktionen

- **🌳 Wunderschöner interaktiver Commit-Graph (DAG)**: Visuelle Darstellung von Multi-Branch-Logik mit klarer Anzeige des Versionsverlaufs.
- **🔍 Hochleistungs-Diff-Viewer**: Millisekundenschnelle Dateivergleiche mit zeilengenauer Syntaxhervorhebung.
- **⚡ Blitzschnell & leichtgewichtig (Tauri+Rust)**: Verabschieden Sie sich von Electrons GB-Speicherverbrauch — genießen Sie ein natives, flüssiges Erlebnis.
- **🛠 Vollständiger Git-Workflow-Support**: Von Staging, Committing, Branch-Management bis hin zu Konfliktlösung und Remote-Synchronisation — alle täglichen Operationen abgedeckt.

---

## 📥 Download

Laden Sie das neueste Installationsprogramm für Ihre Plattform von der Seite [GitHub Releases](https://github.com/Atom112/VaporGit/releases) herunter — kein lokaler Build erforderlich.

| Plattform | Paketformat | Hinweise |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | Doppelklick zur Installation. Erfordert WebView2 Runtime. |
| **macOS** | `.dmg` | Öffnen und VaporGit in den Applications-Ordner ziehen. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` für Debian/Ubuntu; `.rpm` für Fedora/RHEL; `.AppImage` ist universell — `chmod +x` und ausführen. |

---

## 🛠️ Build & Entwicklung

VaporGit verwendet eine hybride Architektur aus modernen Web-Technologien und Rust. Stellen Sie sicher, dass Ihre Entwicklungsumgebung bereit ist.

### 📌 Voraussetzungen

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable channel
- **Systemabhängigkeiten**: Windows-Benutzer benötigen Microsoft C++ Build Tools und WebView2 Runtime.

### 🚀 Schnellstart

```powershell
# Alle Frontend- und Projektabhängigkeiten installieren
npm install

# Nur den Frontend-Entwicklungsserver starten (für Styling- und UI-Arbeiten)
npm run dev

# Vollen Tauri-Desktop-Entwicklungsmodus starten (mit Rust-Hot-Reload)
npm run tauri dev
```

### 📦 Produktions-Build

```powershell
# Frontend-Statik-Assets erstellen
npm run build

# Plattformspezifische Installer erstellen (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 Weitere Informationen

- **🏆 Änderungsprotokoll**: Siehe [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ Fahrplan**: Siehe [doc/plan.md](../doc/plan.md).

---

## 📝 Lizenz

Dieses Projekt ist unter den Bedingungen der `LICENSE`-Datei im Repository-Root lizenziert.