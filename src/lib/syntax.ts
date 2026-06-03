import hljs from 'highlight.js';

const extMap: Record<string, string> = {
  // JavaScript / TypeScript
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  // Web
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  sass: 'scss',
  vue: 'html',
  svelte: 'html',
  astro: 'html',
  // Rust / Go / C family
  rs: 'rust',
  go: 'go',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  groovy: 'groovy',
  gradle: 'gradle',
  // Swift / Dart / Zig
  swift: 'swift',
  dart: 'dart',
  zig: 'zig',
  // Scripting
  py: 'python',
  rb: 'ruby',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  php: 'php',
  r: 'r',
  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  psd1: 'powershell',
  psm1: 'powershell',
  bat: 'dos',
  cmd: 'dos',
  // Functional / Erlang
  hs: 'haskell',
  lhs: 'haskell',
  erl: 'erlang',
  hrl: 'erlang',
  ex: 'elixir',
  exs: 'elixir',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',
  // Data / Config
  json: 'json',
  xml: 'xml',
  xhtml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  // DevOps
  tf: 'hcl',
  dockerfile: 'dockerfile',
  nix: 'nix',
  prisma: 'prisma',
  // Other
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
  diff: 'diff',
  patch: 'diff',
  makefile: 'makefile',
  mk: 'makefile',
  cmake: 'cmake',
};

const nameMap: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  'cmakelists.txt': 'cmake',
  rakefile: 'ruby',
  gemfile: 'ruby',
  procfile: 'bash',
};

export function detectLanguage(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? '';

  const nameKey = fileName.toLowerCase();
  if (nameMap[nameKey]) return nameMap[nameKey];

  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? (extMap[ext] ?? null) : null;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Highlight multiple lines in a single hljs call. Returns array of HTML strings, one per line.
 *  This is significantly faster than calling highlightLine() per line because hljs
 *  lexer initialization and multi-line context parsing are shared across all lines.
 */
export function highlightLines(lines: string[], lang: string | null): string[] {
  if (!lang) return lines.map(escapeHtml);
  try {
    if (!hljs.getLanguage(lang)) return lines.map(escapeHtml);
    const joined = lines.join('\n');
    if (!joined) return [];
    const result = hljs.highlight(joined, { language: lang, ignoreIllegals: true }).value;
    return result.split('\n');
  } catch {
    return lines.map(escapeHtml);
  }
}

/** Highlight a single line of code. Returns HTML string safe for innerHTML. */
export function highlightLine(content: string, lang: string | null): string {
  const text = content.replace(/\n$/, '');
  if (!lang) return escapeHtml(text);
  try {
    if (!hljs.getLanguage(lang)) return escapeHtml(text);
    return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(text);
  }
}

/** Highlight full file content. Returns array of HTML strings, one per line. */
export function highlightFull(content: string, lang: string | null): string[] {
  if (!content) return [];
  if (!lang) {
    const s = content.endsWith('\n') ? content.slice(0, -1) : content;
    return (s === '' ? [] : s.split('\n')).map(escapeHtml);
  }
  try {
    if (!hljs.getLanguage(lang)) {
      const s = content.endsWith('\n') ? content.slice(0, -1) : content;
      return (s === '' ? [] : s.split('\n')).map(escapeHtml);
    }
    const result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
    const html = result.value;
    const s = html.endsWith('\n') ? html.slice(0, -1) : html;
    return s === '' ? [] : s.split('\n');
  } catch {
    const s = content.endsWith('\n') ? content.slice(0, -1) : content;
    return (s === '' ? [] : s.split('\n')).map(escapeHtml);
  }
}
