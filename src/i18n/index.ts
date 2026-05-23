import { createStore } from 'solid-js/store';
import zh from './zh';
import en from './en';

type TransValue = string | ((...args: any[]) => string);
type DeepRecord = { [key: string]: TransValue | DeepRecord };

export type Lang = 'zh-CN' | 'en';

const SUPPORTED_LANGS: Lang[] = ['zh-CN', 'en'];
const STORAGE_KEY = 'vaporgit_lang';

const dictCache = new Map<Lang, DeepRecord>([
  ['zh-CN', zh],
  ['en', en],
]);

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'zh-CN';
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  const browser = navigator.language;
  if (browser.startsWith('zh')) return 'zh-CN';
  return 'en';
}

const [state, setState] = createStore({
  lang: detectLang() as Lang,
});

export function setLang(lang: Lang) {
  setState('lang', lang);
  localStorage.setItem(STORAGE_KEY, lang);
}

function resolveKey(obj: DeepRecord, path: string): TransValue | undefined {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

export function tt(key: string): string {
  const lang = state.lang;  // ← reactive dependency
  const d = dictCache.get(lang);
  if (!d) return key;
  const val = resolveKey(d, key);
  if (typeof val === 'string') return val;
  return key;
}

/**
 * Like tt() but supports interpolation arguments for function-type translations
 * (e.g. submoduleDetected with count and names).
 */
export function ttf(key: string, ...args: any[]): string {
  const lang = state.lang;
  const d = dictCache.get(lang);
  if (!d) return key;
  const val = resolveKey(d, key);
  if (typeof val === 'function') return val(...args);
  if (typeof val === 'string') return val;
  return key;
}

export { state as i18nState };
