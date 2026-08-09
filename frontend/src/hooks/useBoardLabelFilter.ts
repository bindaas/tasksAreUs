import { useEffect } from 'react';
import { useFilter } from '../context/FilterContext';

const EMPTY_LABEL_SET = new Set<string>();

// Reconciles the "Single mode ⇒ at most one tag selected" invariant only for
// the board passed in, only when it's actually viewed under Single mode —
// never touches a different, off-screen board's remembered selection (see
// PLAN-feat-tag-filter-single-mode.md for why a global sweep on mode switch
// was rejected). Runs as an effect, not during render, because
// clearBoardLabelSelection updates state owned by the ancestor
// FilterProvider rather than the calling component's own state.
export function useBoardLabelFilter(boardId: string | null) {
  const { matchMode, getBoardLabelSelection, toggleBoardLabel, clearBoardLabelSelection } = useFilter();

  const reconcileKey = boardId ? `${boardId}:${matchMode}` : null;
  useEffect(() => {
    if (matchMode === 'SINGLE' && boardId) {
      const current = getBoardLabelSelection(boardId);
      if (current.size > 1) clearBoardLabelSelection(boardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconcileKey]);

  const selectedLabelIds = boardId ? getBoardLabelSelection(boardId) : EMPTY_LABEL_SET;
  const toggleLabel = (labelId: string) => { if (boardId) toggleBoardLabel(boardId, labelId); };
  const clearLabels = () => { if (boardId) clearBoardLabelSelection(boardId); };

  return { selectedLabelIds, toggleLabel, clearLabels };
}
