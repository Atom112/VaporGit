<div align="center">
  <img src="../VaporGit.png" alt="VaporGit Logo" width="128" />
  <h1 align="center">VaporGit</h1>
  <p align="center">
    <strong>عميل Git سطح مكتب خفيف الوزن للغاية يعمل عبر المنصات، مبني باستخدام Tauri + SolidJS</strong>
  </p>
  <p align="center">
    يركز VaporGit على تقديم تجربة استخدام أساسية خفيفة وأنيقة — إدارة مرئية جميلة وبديهية وفعالة لـ Git.
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
    <a href="./README.es.md">Español</a> ·
    <a href="./README.pt.md">Português</a> ·
    <a href="./README.ru.md">Русский</a>
  </p>
</div>

<br/>

## ✨ الميزات الأساسية

- **🌳 رسم بياني تفاعلي جميل للـ Commits (DAG)**: عرض بصري لمنطق الفروع المتعددة، يعرض تاريخ الإصدارات بوضوح.
- **🔍 عارض فروق عالي الأداء**: مقارنة فروق الملفات في أجزاء من الثانية مع تمييز بناء الجملة على مستوى الأسطر.
- **⚡ فائق السرعة وخفيف الوزن (Tauri+Rust)**: ودّع استهلاك Electron للذاكرة بالغيغابايت — استمتع بتجربة سلسة قريبة من التطبيقات الأصلية.
- **🛠 دعم كامل لسير عمل Git**: من مرحلة التجهيز (staging)، والالتزام (commit)، وإدارة الفروع، إلى حل التعارضات والمزامنة عن بُعد — جميع العمليات اليومية مغطاة.

---

## 📥 التحميل

قم بتحميل أحدث مثبت لمنصتك من صفحة [GitHub Releases](https://github.com/Atom112/VaporGit/releases) — لا حاجة لبناء محلي.

| المنصة | تنسيق الحزمة | ملاحظات |
|----------|---------------|-------|
| **Windows** | `.msi` / `.exe` | انقر نقراً مزدوجاً للتثبيت. يتطلب WebView2 Runtime. |
| **macOS** | `.dmg` | افتح واسحب VaporGit إلى مجلد التطبيقات. |
| **Linux** | `.deb` / `.AppImage` / `.rpm` | `.deb` لأنظمة Debian/Ubuntu؛ `.rpm` لأنظمة Fedora/RHEL؛ `.AppImage` عالمي — `chmod +x` ثم شغّل. |

---

## 🛠️ البناء والتطوير

يستخدم VaporGit بنية هجينة من تقنيات الويب الحديثة و Rust. تأكد من تجهيز بيئة التطوير قبل البدء.

### 📌 المتطلبات الأساسية

- **Node.js**: 20+
- **npm**: 10+
- **Rust**: قناة مستقرة
- **تبعيات النظام**: مستخدمو Windows يحتاجون إلى Microsoft C++ Build Tools و WebView2 Runtime.

### 🚀 بداية سريعة

```powershell
# تثبيت جميع تبعيات الواجهة الأمامية والمشروع
npm install

# تشغيل خادم تطوير الواجهة الأمامية فقط (لأعمال التنسيق والواجهة)
npm run dev

# تشغيل وضع تطوير Tauri الكامل (مع إعادة التحميل السريع لـ Rust)
npm run tauri dev
```

### 📦 بناء الإصدار النهائي

```powershell
# بناء أصول الواجهة الأمامية الثابتة
npm run build

# بناء مثبتات خاصة بكل منصة (macOS .dmg / Windows .msi / Linux .AppImage)
npm run tauri build
```

---

## 📚 معلومات إضافية

- **🏆 سجل التغييرات**: راجع [CHANGELOG.md](../CHANGELOG.md).
- **🗺️ خريطة الطريق**: راجع [doc/plan.md](../doc/plan.md).

---

## 📝 الترخيص

هذا المشروع مرخص بموجب شروط ملف `LICENSE` في جذر المستودع.