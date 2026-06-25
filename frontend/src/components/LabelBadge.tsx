import type { Label } from '../api/tasks';

const CATEGORY_COLORS: Record<string, string> = {
  mode: 'bg-green-100 text-green-800',
  type: 'bg-purple-100 text-purple-800',
};

interface LabelBadgeProps {
  label: Label;
  small?: boolean;
}

export function LabelBadge({ label, small = false }: LabelBadgeProps) {
  const colorClass = CATEGORY_COLORS[label.category] || 'bg-gray-100 text-gray-800';
  const sizeClass = small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {label.value}
    </span>
  );
}
