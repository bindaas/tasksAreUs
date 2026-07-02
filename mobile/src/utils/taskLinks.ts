export const MAX_TASK_LINKS = 3;

const URL_SCHEME_RE = /^https?:\/\//i;

export function isValidLinkUrl(url: string): boolean {
  return URL_SCHEME_RE.test(url.trim());
}
