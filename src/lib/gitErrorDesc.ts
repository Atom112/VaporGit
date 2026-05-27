import { tt } from '../i18n';

/** i18n key for a given HTTP status code string (e.g. "401" → "errorDesc.http401"). */
function i18nKey(status: string): string {
  return status >= '500' ? 'errorDesc.http5xx' : `errorDesc.http${status}`;
}

/**
 * Wrap an error string with a human-readable description in the current UI
 * language, using the `errorDesc.*` keys from the i18n system.
 *
 * Handles both GitHub API errors (`"HTTP 401: ..."`) and raw libgit2 errors
 * (`"request failed with status code 401"`).
 */
export function describeError(error: unknown): string {
  const errStr = String(error);

  // 1. Extract HTTP status code from error strings
  const match = errStr.match(/\b(4\d\d|5\d\d)\b/);
  if (match) {
    const t = tt(i18nKey(match[1]) as any);
    if (t !== i18nKey(match[1]) && !errStr.includes(t)) {
      return `${errStr}（${t}）`;
    }
  }

  // 2. Special known patterns
  if (/not_?authenticated/i.test(errStr)) {
    const t = tt('errorDesc.notAuthenticated' as any);
    return t !== 'errorDesc.notAuthenticated' ? t : errStr;
  }
  if (/authenticat(ion|e).*failed/i.test(errStr)) {
    const t = tt('errorDesc.authFailed' as any);
    return t !== 'errorDesc.authFailed' ? t : errStr;
  }
  if (/\bnetwork.*error\b/i.test(errStr)) {
    const t = tt('errorDesc.networkError' as any);
    return t !== 'errorDesc.networkError' ? `${errStr}（${t}）` : errStr;
  }
  if (/timeout|timed out/i.test(errStr)) {
    const t = tt('errorDesc.timeout' as any);
    return t !== 'errorDesc.timeout' ? `${errStr}（${t}）` : errStr;
  }
  if (/non-fast-forward|rejected/i.test(errStr)) {
    const t = tt('errorDesc.pushRejected' as any);
    return t !== 'errorDesc.pushRejected' ? `${errStr}（${t}）` : errStr;
  }

  return errStr;
}
