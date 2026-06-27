import { useState, useRef, useEffect } from 'react';
import { useBoard } from '../context/BoardContext';

export function BoardSwitcher() {
  const { boards, activeBoard, setActiveBoard, createBoard } = useBoard();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setNewName('');
        setErr(null);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      const board = await createBoard(trimmed);
      setActiveBoard(board);
      setAdding(false);
      setNewName('');
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create board');
    } finally {
      setBusy(false);
    }
  }

  if (!activeBoard) return null;

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900 group"
      >
        <span className="flex-1 truncate">{activeBoard.name}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => { setActiveBoard(board); setOpen(false); }}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition-colors ${
                board.id === activeBoard.id
                  ? 'text-indigo-600 bg-indigo-50 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="flex-1 truncate">{board.name}</span>
              {board.is_default && (
                <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
              {board.id === activeBoard.id && !board.is_default && (
                <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {adding ? (
              <div className="px-3 py-2">
                {err && <p className="text-xs text-red-500 mb-1">{err}</p>}
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); setErr(null); }
                  }}
                  placeholder="Board name"
                  disabled={busy}
                  className="w-full border border-indigo-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1.5"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleCreate}
                    disabled={busy || !newName.trim()}
                    className="text-xs text-indigo-600 font-medium disabled:opacity-40"
                  >
                    {busy ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => { setAdding(false); setNewName(''); setErr(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
