import { Check, Pencil, Trash2, Loader2, Flag, AlertTriangle, Calendar } from 'lucide-react';
import type { Todo } from '../types/todo';

interface TaskRowProps {
  todo: Todo;
  isUpdating: boolean;
  onToggleStatus: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDeleteRequest: (todo: Todo) => void;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TaskRow({
  todo,
  isUpdating,
  onToggleStatus,
  onEdit,
  onDeleteRequest,
}: TaskRowProps) {
  const isCompleted = todo.status === 'completed';
  const todayIso = getTodayIsoDate();
  const isOverdue = Boolean(todo.due_date && !isCompleted && todo.due_date < todayIso);

  const priorityLabel =
    todo.priority === 'high' ? 'High' : todo.priority === 'low' ? 'Low' : 'Medium';

  const priorityColorClass =
    todo.priority === 'high'
      ? 'text-red-700'
      : todo.priority === 'medium'
        ? 'text-amber-700'
        : 'text-slate-600';

  return (
    <tr className="group border-b border-slate-200 last:border-b-0 hover:bg-slate-50/80 transition-colors">
      <td className="py-3.5 pl-4 pr-2 align-top w-11">
        <button
          type="button"
          onClick={() => onToggleStatus(todo)}
          disabled={isUpdating}
          aria-label={isCompleted ? `Mark "${todo.title}" as pending` : `Mark "${todo.title}" as completed`}
          className={`w-6 h-6 mt-0.5 rounded border flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            isCompleted
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white border-slate-300 hover:border-blue-600 text-transparent'
          } disabled:opacity-60`}
        >
          {isUpdating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
          ) : (
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
        </button>
      </td>

      <td className="py-3.5 px-3 align-top min-w-[220px]">
        <div className="flex flex-col gap-0.5">
          <span
            className={`text-sm font-medium leading-snug ${
              isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
            }`}
          >
            {todo.title}
          </span>
          {todo.description && (
            <p
              className={`text-xs leading-relaxed line-clamp-2 ${
                isCompleted ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {todo.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 sm:hidden">
            <span className={`font-medium ${priorityColorClass}`}>{priorityLabel} priority</span>
            <span aria-hidden="true">·</span>
            <span>{isCompleted ? 'Completed' : 'Pending'}</span>
            {todo.due_date && (
              <>
                <span aria-hidden="true">·</span>
                <span className={`font-mono tabular-nums ${isOverdue ? 'text-red-700 font-medium' : ''}`}>
                  {formatDateDisplay(todo.due_date)}
                </span>
              </>
            )}
          </div>
        </div>
      </td>

      <td className="py-3.5 px-3 align-top hidden sm:table-cell whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${priorityColorClass}`}>
          <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{priorityLabel}</span>
        </span>
      </td>

      <td className="py-3.5 px-3 align-top hidden md:table-cell whitespace-nowrap">
        {todo.due_date ? (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-mono tabular-nums ${
              isOverdue ? 'text-red-700 font-medium' : 'text-slate-600'
            }`}
          >
            {isOverdue ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
            ) : (
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
            <span>{formatDateDisplay(todo.due_date)}</span>
            {isOverdue && <span className="font-sans text-red-700">(Overdue)</span>}
          </span>
        ) : (
          <span className="text-xs text-slate-400">No due date</span>
        )}
      </td>

      <td className="py-3.5 px-3 align-top hidden sm:table-cell whitespace-nowrap">
        <span
          className={`text-xs font-medium ${
            isCompleted ? 'text-emerald-700' : 'text-slate-600'
          }`}
        >
          {isCompleted ? 'Completed' : 'Pending'}
        </span>
      </td>

      <td className="py-3.5 pl-2 pr-4 align-top text-right whitespace-nowrap">
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(todo)}
            disabled={isUpdating}
            aria-label={`Edit "${todo.title}"`}
            className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteRequest(todo)}
            disabled={isUpdating}
            aria-label={`Delete "${todo.title}"`}
            className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xl:inline">Delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
