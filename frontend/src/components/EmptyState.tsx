import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  message,
  subMessage,
  onRefresh,
}: {
  icon: ReactNode;
  message: string;
  subMessage?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="text-center py-16 text-gray-400">
      {icon}
      <p className="text-sm">{message}</p>
      {subMessage && <p className="text-xs text-gray-300 mt-1">{subMessage}</p>}
      {onRefresh && (
        <button onClick={onRefresh} className="mt-4 text-xs text-indigo-500 hover:underline">
          Refresh
        </button>
      )}
    </div>
  );
}

export function FolderIcon() {
  return (
    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}
