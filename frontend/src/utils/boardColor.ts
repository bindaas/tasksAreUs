export const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

/** Returns a board's display color: its own color if set, otherwise a palette
 * color chosen by position so boards without an explicit color still look
 * visually distinct from their neighbors.
 */
export function getBoardColor(color: string | null | undefined, index: number): string {
  return color ?? PALETTE[index % PALETTE.length];
}
