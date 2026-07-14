import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { Task, Label } from '../types';
import { formatDate, isOverdue } from '../utils/taskDateUtils';
import { openTaskLink } from '../utils/taskLinks';

interface TaskCardBodyProps {
  task: Task;
  dateDisplay:
    | { mode: 'split'; mustOverdue: boolean }
    | { mode: 'effective'; effectiveDate: string | null };
  layout: 'inline' | 'stacked';
  priorityBadge: 'toggle' | 'static';
  onTogglePriority?: () => void;
  renderLabels: (labels: Label[]) => ReactNode;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

export function TaskCardBody({
  task,
  dateDisplay,
  layout,
  priorityBadge,
  onTogglePriority,
  renderLabels,
  onEdit,
  onComplete,
  onDelete,
}: TaskCardBodyProps) {
  const priorityIndicator = task.is_high_priority ? (
    priorityBadge === 'static' ? (
      <View className="bg-amber-50 rounded px-1.5 py-0.5 self-start">
        <Text className="text-xs font-semibold text-amber-600">★ High</Text>
      </View>
    ) : (
      <TouchableOpacity
        onPress={onTogglePriority}
        className="rounded px-1.5 py-0.5 self-start"
        style={{ backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text className="text-[10px] font-semibold uppercase text-orange-600">High</Text>
      </TouchableOpacity>
    )
  ) : null;

  const titleEl = (
    <Text
      className={
        layout === 'stacked'
          ? 'text-sm font-medium text-gray-800 leading-snug mb-2'
          : 'text-gray-900 font-medium text-sm leading-snug flex-1'
      }
      numberOfLines={2}
    >
      {task.title}
    </Text>
  );

  const dateEl =
    dateDisplay.mode === 'split' ? (
      <>
        {task.must_do_by && (
          <Text
            className="text-xs mt-1"
            style={{
              color: dateDisplay.mustOverdue ? '#dc2626' : '#6b7280',
              fontWeight: dateDisplay.mustOverdue ? '600' : '400',
            }}
          >
            {dateDisplay.mustOverdue ? 'Overdue · Must do: ' : 'Must do: '}
            {formatDate(task.must_do_by)}
          </Text>
        )}
        {task.target_date && task.target_date !== task.must_do_by && (
          <Text className="text-xs mt-0.5 text-gray-400">Target: {formatDate(task.target_date)}</Text>
        )}
      </>
    ) : (
      dateDisplay.effectiveDate && (
        <View
          className="rounded px-1.5 py-0.5 self-start"
          style={{ backgroundColor: isOverdue(dateDisplay.effectiveDate) ? '#fef2f2' : '#f3f4f6' }}
        >
          <Text
            className="text-xs"
            style={{ color: isOverdue(dateDisplay.effectiveDate) ? '#dc2626' : '#6b7280' }}
          >
            {formatDate(dateDisplay.effectiveDate)}
          </Text>
        </View>
      )
    );

  const linksEl = task.links.length > 0 && (
    <View className="flex-row flex-wrap mt-1">
      {task.links.map((link) => (
        <TouchableOpacity
          key={link.id}
          onPress={() => openTaskLink(link.url)}
          className="mr-3 mb-1 max-w-[45%]"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text className="text-indigo-600 text-xs" numberOfLines={1}>
            🔗 {link.description}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Focused/Today/Tomorrow's backend queries (get_boards_with_tasks, shared by
  // focused_view_service.py and day_view.py) currently only ever return pending
  // tasks, so this gate is presently redundant for the 'stacked' layout — but
  // must be revisited if that query is ever loosened to include other states.
  // TODO: When task-fetching is extended to include done tasks, this pending
  // gate will suddenly hide Delete/Edit for non-pending tasks — update tests then.
  const actionsEl = task.state === 'pending' && (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      {priorityBadge === 'toggle' && onTogglePriority && (
        <TouchableOpacity
          onPress={onTogglePriority}
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: task.is_high_priority ? '#fff7ed' : '#f9fafb' }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: task.is_high_priority ? '#f97316' : '#9ca3af' }}>★</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onEdit}
        className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ color: '#6b7280' }}>✎</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onComplete}
        className="w-8 h-8 rounded-full bg-green-50 items-center justify-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-green-600 text-base font-semibold">✓</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-red-400 text-sm">🗑</Text>
      </TouchableOpacity>
    </View>
  );

  if (layout === 'stacked') {
    return (
      <>
        {priorityIndicator && <View className="mb-1.5">{priorityIndicator}</View>}
        {titleEl}
        {dateEl}
        {renderLabels(task.labels)}
        {linksEl}
        {actionsEl && <View className="flex-row justify-end mt-2">{actionsEl}</View>}
      </>
    );
  }

  return (
    <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
      <View className="flex-1">
        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
          {priorityIndicator}
          {titleEl}
        </View>
        {dateEl}
        {renderLabels(task.labels)}
        {linksEl}
      </View>
      {actionsEl}
    </View>
  );
}
