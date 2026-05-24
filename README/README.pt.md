<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Um cliente Git desktop multiplataforma ultraleve construído com Tauri + SolidJS</strong>
  </p>
  <p align="center">
    O VaporGit foca em fornecer uma experiência central leve e elegante — gerenciamento visual de Git bonito, intuitivo e eficiente.
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
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ Principais recursos

- **🌳 Belo gráfico de commits interativo (DAG)**: Renderização visual de lógica multi-ramo, exibindo claramente o histórico de versões.
- **🔍 Visualizador de diff de alto desempenho**: Comparação de arquivos em milissegundos com destaque de sintaxe em nível de linha.
- **⚡ Extremamente rápido e leve (Tauri+Rust)**: Diga adeus aos gigabytes de memória do Electron — desfrute de uma experiência suave e nativa.
- **🛠 Suporte completo a fluxo de trabalho Git**: Do staging, commit, gerenciamento de ramos, à resolução de conflitos e sincronização remota — todas as operações diárias cobertas.

---

## 📥 Download

Baixe o instalador mais recente para sua plataforma na página de [GitHub Releases](https://github.com/Atom112/VaporGit/releases) — sem necessidade de compilação local.

| Plataforma | Formato do pacote | Notas |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | Clique duas vezes para instalar. Requer WebView2 Runtime. |
| **macOS** | `.dmg` | Abra e arraste o VaporGit para a pasta Applications. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` para Debian/Ubuntu; `.rpm` para Fedora/RHEL; `.AppImage` é universal — `chmod +x` e execute. |

---

## 🛠️ Compilação e desenvolvimento

O VaporGit usa uma arquitetura híbrida de tecnologias web modernas e Rust. Certifique-se de que seu ambiente esteja pronto antes de começar.

### 📌 Pré-requisitos

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: canal stable
- **Dependências do sistema**: Usuários Windows precisam do Microsoft C++ Build Tools e WebView2 Runtime.

### 🚀 Início rápido

```powershell
# Instalar todas as dependências do frontend e do projeto
npm install

# Iniciar apenas o servidor de desenvolvimento do frontend (para trabalhar em estilo e interface)
npm run dev

# Iniciar o modo de desenvolvimento completo do Tauri (com recarga rápida de Rust)
npm run tauri dev
```

### 📦 Compilação de produção

```powershell
# Compilar os assets estáticos do frontend
npm run build

# Compilar instaladores específicos da plataforma (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 Mais informações

- **🏆 Registro de alterações**: Consulte [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ Roteiro**: Consulte [doc/plan.md](../doc/plan.md).

---

## 📝 Licença

Este projeto é licenciado sob os termos do arquivo `LICENSE` na raiz do repositório.