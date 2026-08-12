interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

// Computes the scrollTop `target` needs so its scroll position (as a
// fraction of its own scrollable range) matches `source`'s fraction.
// Returns null when `source` has no scrollable range (fraction undefined)
// or `target` has no scrollable range (nothing to sync to).
export function computeSyncedScrollTop(
  source: ScrollMetrics,
  target: Pick<ScrollMetrics, 'scrollHeight' | 'clientHeight'>
): number | null {
  const sourceRange = source.scrollHeight - source.clientHeight;
  if (sourceRange <= 0) return null;
  const targetRange = target.scrollHeight - target.clientHeight;
  if (targetRange <= 0) return null;
  const ratio = source.scrollTop / sourceRange;
  return ratio * targetRange;
}
