import { useEffect, useState, type FormEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Todo, TodoInput, TodoPriority, TodoStatus } from '../types/todo';

interface TaskModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTodo: Todo | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: TodoInput) => Promise<void>;
}

const PRIORITIES: Array<{ value: TodoPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export function TaskModal({
  isOpen,
  mode,
  initialTodo,
  isSubmitting,
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TodoStatus>('pending');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValidationError(null);
    if (mode === 'edit' && initialTodo) {
      setTitle(initialTodo.title);
      setDescription(initialTodo.description);
      setPriority(initialTodo.priority);
      setDueDate(initialTodo.due_date ?? '');
      setStatus(initialTodo.status);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setStatus('pending');
    }
  }, [isOpen, mode, initialTodo]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError('Please enter a task title.');
      return;
    }

    setValidationError(null);
    await onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      priority,
      due_date: dueDate ? dueDate : null,
      status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="task-modal-title" className="text-base font-semibold text-slate-900">
            {mode === 'create' ? 'New Task' : 'Edit Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
          {validationError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {validationError}
            </div>
          )}

          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-slate-700 mb-1.5">
              Title <span className="text-red-600">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              required
              maxLength={160}
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Prepare quarterly roadmap review"
              className="w-full min-h-[42px] px-3.5 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Description
            </label>
            <textarea
              id="task-description"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes, context, or acceptance criteria..."
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-slate-400 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Priority</span>
              <div
                role="group"
                aria-label="Task priority"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md"
              >
                {PRIORITIES.map((item) => {
                  const active = priority === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPriority(item.value)}
                      className={`min-h-[36px] px-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="task-due-date" className="text-sm font-medium text-slate-700">
                  Due date
                </label>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Status</span>
              <div
                role="group"
                aria-label="Task status"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md max-w-xs"
              >
                {(['pending', 'completed'] as const).map((option) => {
                  const active = status === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setStatus(option)}
                      className={`min-h-[36px] px-3 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {option === 'pending' ? 'Pending' : 'Completed'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[40px] px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : mode === 'create'
                    ? 'Create Task'
                    : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
