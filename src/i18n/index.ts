import { createStore } from 'solid-js/store';
import zh from './zh';
import zhTW from './zh-TW';
import en from './en';
import ja from './ja';
import ko from './ko';
import fr from './fr';
import de from './de';
import ar from './ar';
import es from './es';
import pt from './pt';
import ru from './ru';

type TransValue = string | ((...args: any[]) => string);
type DeepRecord = { [key: string]: TransValue | DeepRecord };

export type Lang = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'ar' | 'es' | 'pt' | 'ru';

const SUPPORTED_LANGS: Lang[] = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'ar', 'es', 'pt', 'ru'];
const STORAGE_KEY = 'vaporgit_lang';

const dictCache = new Map<Lang, DeepRecord>([
  ['zh-CN', zh],
  ['zh-TW', zhTW],
  ['en', en],
  ['ja', ja],
  ['ko', ko],
  ['fr', fr],
  ['de', de],
  ['ar', ar],
  ['es', es],
  ['pt', pt],
  ['ru', ru],
]);

function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  const browser = navigator.language;
  if (browser.startsWith('zh-TW') || browser.startsWith('zh-HK') || browser.startsWith('zh-Hant')) return 'zh-TW';
      if (browser.startsWith('zh')) return 'zh-CN';
  if (browser.startsWith('ja')) return 'ja';
  if (browser.startsWith('ko')) return 'ko';
  if (browser.startsWith('fr')) return 'fr';
  if (browser.startsWith('de')) return 'de';
  if (browser.startsWith('ar')) return 'ar';
  if (browser.startsWith('es')) return 'es';
  if (browser.startsWith('pt')) return 'pt';
  if (browser.startsWith('ru')) return 'ru';
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