<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Un client Git desktop cross-plateforme ultra-léger construit avec Tauri + SolidJS</strong>
  </p>
  <p align="center">
    VaporGit se concentre sur la fourniture d'une expérience de base légère et élégante — une gestion visuelle de Git belle, intuitive et efficace.
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
    <a href="./README.de.md">Deutsch</a> ·
    <a href="./README.ar.md">العربية</a> ·
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ Fonctionnalités clés

- **🌳 Magnifique graphe de commits interactif (DAG)** : Rendu visuel de la logique multi-branche, affichant clairement l'historique des versions.
- **🔍 Visionneuse de différences haute performance** : Comparaison de fichiers en millisecondes avec surlignage syntaxique au niveau des lignes.
- **⚡ Ultra-rapide & léger (Tauri+Rust)** : Dites adieu aux gigaoctets de mémoire d'Electron — profitez d'une expérience fluide et native.
- **🛠 Support complet du workflow Git** : Du staging, commit, gestion de branches, à la résolution de conflits et synchronisation distante — toutes les opérations quotidiennes couvertes.

---

## 📥 Téléchargement

Téléchargez le dernier installateur pour votre plateforme depuis la page [GitHub Releases](https://github.com/Atom112/VaporGit/releases) — aucune construction locale requise.

| Plateforme | Format du paquet | Notes |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | Double-clic pour installer. Nécessite WebView2 Runtime. |
| **macOS** | `.dmg` | Ouvrez et glissez VaporGit dans le dossier Applications. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` pour Debian/Ubuntu ; `.rpm` pour Fedora/RHEL ; `.AppImage` est universel — `chmod +x` et exécutez. |

---

## 🛠️ Construction et développement

VaporGit utilise une architecture hybride de technologies Web modernes et de Rust. Assurez-vous que votre environnement est prêt avant de commencer.

### 📌 Prérequis

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: canal stable
- **Dépendances système** : Les utilisateurs Windows ont besoin de Microsoft C++ Build Tools et de WebView2 Runtime.

### 🚀 Démarrage rapide

```powershell
# Installer toutes les dépendances frontend et projet
npm install

# Démarrer uniquement le serveur de développement frontend (pour le style et l'interface)
npm run dev

# Démarrer le mode de développement Tauri complet (avec rechargement à chaud Rust)
npm run tauri dev
```

### 📦 Construction de production

```powershell
# Construire les actifs statiques frontend
npm run build

# Construire les installateurs spécifiques à la plateforme (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 Plus d'informations

- **🏆 Journal des modifications** : Voir [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ Feuille de route** : Voir [doc/plan.md](../doc/plan.md).

---

## 📝 Licence

Ce projet est sous licence selon les termes du fichier `LICENSE` à la racine du dépôt.