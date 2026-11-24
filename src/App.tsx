import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Plus,
  Search,
  RefreshCw,
  Menu,
  AlertCircle,
  CheckSquare,
  ArrowUpDown,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from './lib/supabase';
import { createTodo, deleteTodo, fetchTodos, updateTodo } from './services/todoService';
import type {
  Todo,
  TodoFilterView,
  TodoInput,
  TodoPriority,
  TodoSortOption,
} from './types/todo';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TaskRow } from './components/TaskRow';
import { TaskModal } from './components/TaskModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ToastBanner, type ToastMessage } from './components/ToastBanner';

function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const VIEW_TITLES: Record<TodoFilterView, string> = {
  all: 'All Tasks',
  pending: 'Pending Tasks',
  completed: 'Completed Tasks',
  overdue: 'Overdue Tasks',
  high: 'High Priority Tasks',
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<TodoFilterView>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TodoSortOption>('newest');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const [updatingTodoIds, setUpdatingTodoIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Todo | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Initialize and subscribe to Supabase Auth session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setTodos([]);
        setTodosError(null);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadTodos = useCallback(async (userId: string) => {
    setTodosLoading(true);
    setTodosError(null);
    try {
      const rows = await fetchTodos(userId);
      setTodos(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load tasks from Supabase.';
      setTodosError(msg);
      showToast('error', msg);
    } finally {
      setTodosLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (session?.user?.id) {
      void loadTodos(session.user.id);
    }
  }, [session?.user?.id, loadTodos]);

  const counts = useMemo(() => {
    const todayIso = getTodayIsoDate();
    let pending = 0;
    let completed = 0;
    let overdue = 0;
    let high = 0;

    for (const todo of todos) {
      if (todo.status === 'completed') {
        completed += 1;
      } else {
        pending += 1;
        if (todo.due_date && todo.due_date < todayIso) {
          overdue += 1;
        }
      }
      if (todo.priority === 'high' && todo.status !== 'completed') {
        high += 1;
      }
    }

    return {
      all: todos.length,
      pending,
      completed,
      overdue,
      high,
    };
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const todayIso = getTodayIsoDate();
    const query = searchQuery.trim().toLowerCase();

    const matching = todos.filter((todo) => {
      if (activeView === 'pending' && todo.status !== 'pending') return false;
      if (activeView === 'completed' && todo.status !== 'completed') return false;
      if (activeView === 'overdue') {
        if (todo.status === 'completed' || !todo.due_date || todo.due_date >= todayIso) {
          return false;
        }
      }
      if (activeView === 'high' && (todo.priority !== 'high' || todo.status === 'completed')) {
        return false;
      }

      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) {
        return false;
      }

      if (query) {
        const hay = `${todo.title} ${todo.description}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      return true;
    });

    return [...matching].sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (diff !== 0) return diff;
      }
      if (sortBy === 'due_date') {
        if (a.due_date && b.due_date) {
          const cmp = a.due_date.localeCompare(b.due_date);
          if (cmp !== 0) return cmp;
        } else if (a.due_date && !b.due_date) {
          return -1;
        } else if (!a.due_date && b.due_date) {
          return 1;
        }
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [todos, activeView, priorityFilter, searchQuery, sortBy]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingTodo(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (todo: Todo) => {
    setModalMode('edit');
    setEditingTodo(todo);
    setModalOpen(true);
  };

  const handleSaveTask = async (input: TodoInput) => {
    if (!session?.user?.id) return;
    setIsSavingTask(true);
    try {
      if (modalMode === 'create') {
        const created = await createTodo(session.user.id, input);
        setTodos((prev) => [created, ...prev]);
        setModalOpen(false);
        showToast('success', 'Task created and saved to Supabase.');
      } else if (editingTodo) {
        const updated = await updateTodo(session.user.id, editingTodo.id, input);
        setTodos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setModalOpen(false);
        setEditingTodo(null);
        showToast('success', 'Task updated in Supabase.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save task.';
      showToast('error', msg);
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleToggleStatus = async (todo: Todo) => {
    if (!session?.user?.id) return;
    const nextStatus = todo.status === 'completed' ? 'pending' : 'completed';

    setUpdatingTodoIds((prev) => {
      const next = new Set(prev);
      next.add(todo.id);
      return next;
    });

    try {
      const updated = await updateTodo(session.user.id, todo.id, { status: nextStatus });
      setTodos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(
        'success',
        nextStatus === 'completed' ? 'Task marked as completed.' : 'Task marked as pending.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update task status.';
      showToast('error', msg);
    } finally {
      setUpdatingTodoIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!session?.user?.id || !deleteTarget) return;
    setIsDeletingTask(true);
    try {
      await deleteTodo(session.user.id, deleteTarget.id);
      setTodos((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      showToast('success', 'Task deleted from Supabase.');
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to delete task.';
      showToast('error', msg);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast('error', error.message);
      }
    } finally {
      setSigningOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>Restoring session...</span>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <h1 className="text-lg font-semibold text-slate-900">Supabase Configuration Required</h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{supabaseConfigError}</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <AuthScreen />;
  }

  const userEmail = session.user.email ?? 'Signed-in User';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        counts={counts}
        userEmail={userEmail}
        onSignOut={handleSignOut}
        signingOut={signingOut}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden w-10 h-10 -ml-2 flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{VIEW_TITLES[activeView]}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => session.user.id && loadTodos(session.user.id)}
              disabled={todosLoading}
              aria-label="Refresh tasks"
              className="min-h-[40px] px-3 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-500 ${todosLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Task</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-6xl w-full mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5">
              <p className="text-xs text-slate-500">Total Tasks</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {counts.all}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5">
              <p className="text-xs text-slate-500">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 font-mono tabular-nums">
                {counts.pending}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5">
              <p className="text-xs text-slate-500">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700 font-mono tabular-nums">
                {counts.completed}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-4 py-3.5">
              <p className="text-xs text-slate-500">Overdue</p>
              <p
                className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
                  counts.overdue > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {counts.overdue}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks by title or description..."
                  aria-label="Search tasks"
                  className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  role="group"
                  aria-label="Filter by priority"
                  className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md"
                >
                  {(['all', 'high', 'medium', 'low'] as const).map((level) => {
                    const active = priorityFilter === level;
                    const label =
                      level === 'all'
                        ? 'All'
                        : level.charAt(0).toUpperCase() + level.slice(1);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setPriorityFilter(level)}
                        className={`min-h-[32px] px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="inline-flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <select
                    aria-label="Sort tasks"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as TodoSortOption)}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="newest">Newest first</option>
                    <option value="due_date">Due date</option>
                    <option value="priority">Priority</option>
                  </select>
                </div>
              </div>
            </div>

            {todosError && (
              <div className="p-6 border-b border-slate-200 bg-red-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Unable to load tasks from Supabase</p>
                    <p className="text-xs text-red-700 mt-0.5">{todosError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => session.user.id && loadTodos(session.user.id)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 hover:bg-red-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {todosLoading ? (
              <div className="divide-y divide-slate-200" aria-busy="true" aria-label="Loading tasks">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="px-4 py-4 flex items-center gap-4">
                    <div className="w-6 h-6 rounded bg-slate-200 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                    </div>
                    <div className="hidden sm:block h-3.5 w-16 bg-slate-100 rounded animate-pulse" />
                    <div className="hidden md:block h-3.5 w-24 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
                  <CheckSquare className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {todos.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  {todos.length === 0
                    ? 'Create your first task to start organizing your personal workflow in Supabase.'
                    : 'Try adjusting your search query, priority filter, or sidebar view.'}
                </p>
                {todos.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="mt-5 min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Create First Task</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('all');
                      setPriorityFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-5 min-h-[40px] px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                      <th className="py-2.5 pl-4 pr-2 w-11">
                        <span className="sr-only">Done</span>
                      </th>
                      <th className="py-2.5 px-3">Task</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell whitespace-nowrap">Priority</th>
                      <th className="py-2.5 px-3 hidden md:table-cell whitespace-nowrap">Due Date</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell whitespace-nowrap">Status</th>
                      <th className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTodos.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        isUpdating={updatingTodoIds.has(todo.id)}
                        onToggleStatus={handleToggleStatus}
                        onEdit={handleOpenEditModal}
                        onDeleteRequest={setDeleteTarget}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      <TaskModal
        isOpen={modalOpen}
        mode={modalMode}
        initialTodo={editingTodo}
        isSubmitting={isSavingTask}
        onClose={() => {
          if (!isSavingTask) {
            setModalOpen(false);
            setEditingTodo(null);
          }
        }}
        onSubmit={handleSaveTask}
      />

      <DeleteConfirmModal
        todo={deleteTarget}
        isDeleting={isDeletingTask}
        onCancel={() => {
          if (!isDeletingTask) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
