import { tt } from '../i18n';

/** i18n key for a given HTTP status code string (e.g. "401" → "errorDesc.http401"). */
function i18nKey(status: string): string {
  return status >= '500' ? 'errorDesc.http5xx' : `errorDesc.http${status}`;
}

/**
 * Wrap an error string with a human-readable description in the current UI
 * language, using the `errorDesc.*` keys from the i18n system.
 *
 * Returns the translated description when available, falling back to the
 * original error string. For HTTP errors, also includes the status code
 * for reference.
 */
export function describeError(error: unknown): string {
  const errStr = String(error);

  // 1. Extract HTTP status code from error strings
  const match = errStr.match(/(?:HTTP[\/\s]*|status\s+code\s+|状态码\s*)(4\d\d|5\d\d)\b/);
  if (match) {
    const t = tt(i18nKey(match[1]) as any);
    if (t !== i18nKey(match[1])) {
      return `HTTP ${match[1]} — ${t}`;
    }
  }

  // 2. Special known patterns — use translated description when available
  if (/not_?authenticated/i.test(errStr) || /authenticat(ion|e).*failed/i.test(errStr)) {
    const t = tt('errorDesc.notAuthenticated' as any);
    if (t !== 'errorDesc.notAuthenticated') return t;
  }
  if (/\bnetwork.*error\b/i.test(errStr)) {
    const t = tt('errorDesc.networkError' as any);
    if (t !== 'errorDesc.networkError') return t;
  }
  if (/timeout|timed out/i.test(errStr)) {
    const t = tt('errorDesc.timeout' as any);
    if (t !== 'errorDesc.timeout') return t;
  }
  if (/non-fast-forward|rejected/i.test(errStr)) {
    const t = tt('errorDesc.pushRejected' as any);
    if (t !== 'errorDesc.pushRejected') return t;
  }

  return errStr;
}
