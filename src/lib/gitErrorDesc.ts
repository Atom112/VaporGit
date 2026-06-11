import { tt } from '../i18n';

/** i18n key for a given HTTP status code string (e.g. "401" → "errorDesc.http401"). */
function i18nKey(status: string): string {
  return status >= '500' ? 'errorDesc.http5xx' : `errorDesc.http${status}`;
}

/**
 * Try to look up a translated message for a given i18n key.
 * Returns the translation if found, or null if the key doesn't exist.
 */
function lookup(key: string): string | null {
  const t = tt(key as any);
  return t !== key ? t : null;
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

  // 1. Extract HTTP status code from error strings (match both English and Chinese patterns)
  const match = errStr.match(/(?:HTTP[\/\s]*|status\s+code\s+|状态码\s*)(4\d\d|5\d\d)\b/);
  if (match) {
    const t = lookup(i18nKey(match[1]));
    if (t) {
      return `HTTP ${match[1]} — ${t}`;
    }
  }

  // 2. Special known patterns — match both English and Chinese error messages

  // Authentication / login errors
  if (
    /not_?authenticated|authenticat(ion|e).*failed|未登录|认证失败|登录已过期/i.test(errStr)
  ) {
    const t = lookup('errorDesc.notAuthenticated');
    if (t) return t;
  }
  if (/authenticat(ion|e).*failed|认证失败|登录失败/i.test(errStr)) {
    const t = lookup('errorDesc.authFailed');
    if (t) return t;
  }

  // Network errors
  if (
    /network.*error|网络错误|网络异常|连接失败|connection\s+(refused|reset|failed)/i.test(errStr)
  ) {
    const t = lookup('errorDesc.networkError');
    if (t) return t;
  }

  // Timeout
  if (
    /timeout|timed out|超时|连接超时|请求超时/i.test(errStr)
  ) {
    const t = lookup('errorDesc.timeout');
    if (t) return t;
  }

  // Push rejected
  if (
    /non-fast-forward|rejected|推送被拒绝|被拒绝.*推送/i.test(errStr)
  ) {
    const t = lookup('errorDesc.pushRejected');
    if (t) return t;
  }

  // Not found (resource, branch, file, etc)
  if (
    /not found|未找到|不存.*在|无法找到|找不到/i.test(errStr)
  ) {
    const t = lookup('errorDesc.notFound');
    if (t) return t;
  }

  // Already exists
  if (
    /already exists|已存在|已经存在/i.test(errStr)
  ) {
    const t = lookup('errorDesc.alreadyExists');
    if (t) return t;
  }

  // Permission denied
  if (
    /permission denied|权限.*不[足够]|没有.*权限|access denied/i.test(errStr)
  ) {
    const t = lookup('errorDesc.permissionDenied');
    if (t) return t;
  }

  // Merge conflict
  if (
    /merge conflict|conflict|冲突|合并.*冲突/i.test(errStr)
  ) {
    const t = lookup('errorDesc.mergeConflict');
    if (t) return t;
  }

  // Branch not found (specific)
  if (
    /branch.*not found|分支.*不存|没有.*分支/i.test(errStr)
  ) {
    const t = lookup('errorDesc.branchNotFound');
    if (t) return t;
  }

  // Nothing to commit
  if (
    /nothing to commit|nothing.*commit|没有变|无.*变|没有.*提交|干净的/i.test(errStr)
  ) {
    const t = lookup('errorDesc.nothingToCommit');
    if (t) return t;
  }

  return errStr;
}
