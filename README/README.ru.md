<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Чрезвычайно лёгкий кроссплатформенный Git-клиент на Tauri + SolidJS</strong>
  </p>
  <p align="center">
    VaporGit стремится обеспечить лёгкий и элегантный пользовательский опыт — красивое, интуитивное и эффективное визуальное управление Git.
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
    <a href="./README.de.md">Deutsch</a> ·
    <a href="./README.ar.md">العربية</a> ·
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a>
  </p>
</div>

<br/>

## ✨ Ключевые возможности

- **🌳 Красивый интерактивный граф коммитов (DAG)**: Визуальное отображение многоветвечной логики с чётким представлением истории версий.
- **🔍 Высокопроизводительный просмотрщик Diff**: Сравнение файлов за миллисекунды с подсветкой синтаксиса на уровне строк.
- **⚡ Молниеносная скорость и лёгкость (Tauri+Rust)**: Попрощайтесь с гигабайтами памяти Electron — наслаждайтесь плавным, нативным опытом.
- **🛠 Полная поддержка Git-процессов**: От индексации, коммитов, управления ветками до разрешения конфликтов и удалённой синхронизации — все повседневные операции.

---

## 📥 Загрузка

Загрузите последний установщик для вашей платформы со страницы [GitHub Releases](https://github.com/Atom112/VaporGit/releases) — локальная сборка не требуется.

| Платформа | Формат пакета | Примечания |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | Двойной щелчок для установки. Требуется WebView2 Runtime. |
| **macOS** | `.dmg` | Откройте и перетащите VaporGit в папку Applications. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` для Debian/Ubuntu; `.rpm` для Fedora/RHEL; `.AppImage` — универсальный формат: `chmod +x` и запускайте. |

---

## 🛠️ Сборка и разработка

VaporGit использует гибридную архитектуру современных веб-технологий и Rust. Убедитесь, что ваше окружение готово перед началом работы.

### 📌 Требования

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable-канал
- **Системные зависимости**: Пользователям Windows требуются Microsoft C++ Build Tools и WebView2 Runtime.

### 🚀 Быстрый старт

```powershell
# Установка всех зависимостей фронтенда и проекта
npm install

# Запуск только сервера разработки фронтенда (для работы со стилями и интерфейсом)
npm run dev

# Запуск полного режима разработки Tauri (с горячей перезагрузкой Rust)
npm run tauri dev
```

### 📦 Сборка релиза

```powershell
# Сборка статических ресурсов фронтенда
npm run build

# Сборка установщиков для конкретных платформ (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 Дополнительная информация

- **🏆 Журнал изменений**: Смотрите [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ План развития**: Смотрите [doc/plan.md](../doc/plan.md).

---

## 📝 Лицензия

Этот проект лицензирован на условиях файла `LICENSE` в корне репозитория.