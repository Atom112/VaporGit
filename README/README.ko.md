<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>Tauri + SolidJS 기반의 초경량 크로스플랫폼 Git 데스크톱 클라이언트</strong>
  </p>
  <p align="center">
    VaporGit은 가볍고 우아한 핵심 사용 경험을 제공하는 데 중점을 두어, 아름답고 직관적이며 효율적인 Git 시각적 관리를 실현합니다.
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
    <a href="./README.fr.md">Français</a> ·
    <a href="./README.de.md">Deutsch</a> ·
    <a href="./README.ar.md">العربية</a> ·
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ 주요 기능

- **🌳 아름다운 대화형 커밋 그래프 (DAG)**: 멀티 브랜치의 복잡한 로직을 시각적으로 렌더링하여 버전 기록을 명확하게 표시합니다.
- **🔍 고성능 Diff 뷰어**: 밀리초 단위의 파일 차이 비교, 라인 수준의 구문 강조 지원.
- **⚡ 초고속 & 경량 (Tauri+Rust)**: Electron의 GB 단위 메모리 사용에서 벗어나 네이티브처럼 부드러운 경험을 제공합니다.
- **🛠 완전한 Git 워크플로우 지원**: 스테이징, 커밋, 브랜치 관리부터 충돌 해결, 원격 동기화까지 일상적인 모든 작업을 지원합니다.

---

## 📥 다운로드

[GitHub Releases](https://github.com/Atom112/VaporGit/releases) 페이지에서 각 플랫폼용 최신 설치 프로그램을 다운로드할 수 있습니다. 로컬 빌드가 필요하지 않습니다.

| 플랫폼 | 패키지 형식 | 비고 |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | 더블 클릭으로 설치. WebView2 Runtime 필요. |
| **macOS** | `.dmg` | 열고 VaporGit을 Applications 폴더로 드래그. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb`는 Debian/Ubuntu 계열, `.rpm`은 Fedora/RHEL 계열, `.AppImage`는 범용 — `chmod +x` 후 실행. |

---

## 🛠️ 빌드 및 개발

VaporGit은 최신 웹 기술과 Rust의 하이브리드 아키텍처를 사용합니다. 시작하기 전에 개발 환경을 준비하세요.

### 📌 필수 조건

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: stable 채널
- **시스템 종속성**: Windows 사용자는 Microsoft C++ Build Tools와 WebView2 Runtime이 필요합니다.

### 🚀 빠른 시작

```powershell
# 프론트엔드 및 프로젝트 종속성 설치
npm install

# 프론트엔드 개발 서버만 시작 (스타일링 및 UI 작업용)
npm run dev

# 전체 Tauri 데스크톱 개발 모드 시작 (Rust 핫 리로드 포함)
npm run tauri dev
```

### 📦 프로덕션 빌드

```powershell
# 프론트엔드 정적 자산 빌드
npm run build

# 플랫폼별 설치 프로그램 빌드 (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 추가 정보

- **🏆 변경 로그**: [CHANGELOG.md](../CHANGELOG.md)를 참조하세요.
- **🗺️ 로드맵**: [doc/plan.md](../doc/plan.md)를 참조하세요.

---

## 📝 라이선스

이 프로젝트는 저장소 루트의 `LICENSE` 파일 조건에 따라 라이선스가 부여됩니다.