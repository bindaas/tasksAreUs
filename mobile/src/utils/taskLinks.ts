import { Linking } from 'react-native';
import type { TaskLink } from '../types';

export const MAX_TASK_LINKS = 3;

const URL_SCHEME_RE = /^https?:\/\//i;

export function isValidLinkUrl(url: string): boolean {
  return URL_SCHEME_RE.test(url.trim());
}

export function openTaskLink(url: string) {
  if (!isValidLinkUrl(url)) return;
  Linking.openURL(url.trim());
}

function isBlankLink(link: TaskLink): boolean {
  return link.url.trim() === '' && link.description.trim() === '';
}

// Ensures the link list always has exactly one blank, ready-to-fill row at
// the end while under MAX_TASK_LINKS. Collapses any extra blank rows down to
// the first one encountered (preserving its id/identity, so a row a user is
// actively editing doesn't get unmounted) — this can otherwise happen if a
// row is filled in (spawning a new trailing blank row) and then cleared back
// to blank, leaving two blank rows side by side.
export function withReadyLinkRow(links: TaskLink[], makeId: () => string): TaskLink[] {
  let sawBlank = false;
  let changed = false;
  const deduped: TaskLink[] = [];
  for (const link of links) {
    if (isBlankLink(link)) {
      if (sawBlank) {
        changed = true;
        continue;
      }
      sawBlank = true;
    }
    deduped.push(link);
  }
  const base = changed ? deduped : links;

  const last = base[base.length - 1];
  if ((!last || !isBlankLink(last)) && base.length < MAX_TASK_LINKS) {
    return [...base, { id: makeId(), url: '', description: '' }];
  }
  return base;
}
