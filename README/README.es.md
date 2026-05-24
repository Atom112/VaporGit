<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Un cliente Git de escritorio multiplataforma ultraligero construido con Tauri + SolidJS</strong>
  </p>
  <p align="center">
    VaporGit se enfoca en ofrecer una experiencia central ligera y elegante — una gestión visual de Git hermosa, intuitiva y eficiente.
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
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ Características principales

- **🌳 Hermoso gráfico de commits interactivo (DAG)**: Representación visual de lógica multi-rama, mostrando claramente el historial de versiones.
- **🔍 Visor de diferencias de alto rendimiento**: Comparación de archivos en milisegundos con resaltado de sintaxis a nivel de línea.
- **⚡ Rápido y ligero (Tauri+Rust)**: Dile adiós a los gigabytes de memoria de Electron — disfruta de una experiencia fluida como nativa.
- **🛠 Soporte completo de flujo de trabajo Git**: Desde staging, commits, gestión de ramas, hasta resolución de conflictos y sincronización remota — todas las operaciones diarias cubiertas.

---

## 📥 Descarga

Descarga el instalador más reciente para tu plataforma desde la página de [GitHub Releases](https://github.com/Atom112/VaporGit/releases) — no requiere compilación local.

| Plataforma | Formato de paquete | Notas |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | Doble clic para instalar. Requiere WebView2 Runtime. |
| **macOS** | `.dmg` | Abre y arrastra VaporGit a la carpeta de Aplicaciones. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` para Debian/Ubuntu; `.rpm` para Fedora/RHEL; `.AppImage` es universal — `chmod +x` y ejecuta. |

---

## 🛠️ Compilación y desarrollo

VaporGit utiliza una arquitectura híbrida de tecnologías web modernas y Rust. Asegúrate de tener tu entorno listo antes de comenzar.

### 📌 Requisitos previos

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: canal stable
- **Dependencias del sistema**: Los usuarios de Windows necesitan Microsoft C++ Build Tools y WebView2 Runtime.

### 🚀 Inicio rápido

```powershell
# Instalar todas las dependencias del frontend y del proyecto
npm install

# Iniciar solo el servidor de desarrollo del frontend (para trabajar en estilos e interfaz)
npm run dev

# Iniciar el modo de desarrollo completo de Tauri (con recarga en caliente de Rust)
npm run tauri dev
```

### 📦 Compilación de producción

```powershell
# Compilar los activos estáticos del frontend
npm run build

# Compilar instaladores específicos de la plataforma (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 Más información

- **🏆 Registro de cambios**: Consulta [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ Hoja de ruta**: Consulta [doc/plan.md](../doc/plan.md).

---

## 📝 Licencia

Este proyecto está licenciado bajo los términos del archivo `LICENSE` en la raíz del repositorio.