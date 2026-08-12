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

// Sub-pixel float drift between the two panes' independently-computed
// ratios would otherwise cause a redundant scrollTop write (and thus a
// redundant reciprocal `scroll` event) on every synced frame.
const SCROLL_SYNC_EPSILON_PX = 1;

// Whether a scrollTop write is actually needed, given the element's current
// position. Used to break the mutual-scroll-listener feedback loop without
// relying on any assumption about `scroll`-event timing: the reciprocal
// call this write triggers will recompute a value already within epsilon
// of the element's current scrollTop, so it naturally no-ops instead of
// needing to be suppressed.
export function shouldApplySync(currentScrollTop: number, computedScrollTop: number): boolean {
  return Math.abs(currentScrollTop - computedScrollTop) >= SCROLL_SYNC_EPSILON_PX;
}
