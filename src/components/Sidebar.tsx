import {
  CheckSquare,
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  LogOut,
  X,
} from 'lucide-react';
import type { TodoFilterView } from '../types/todo';

interface SidebarCounts {
  all: number;
  pending: number;
  completed: number;
  overdue: number;
  high: number;
}

interface SidebarProps {
  activeView: TodoFilterView;
  onSelectView: (view: TodoFilterView) => void;
  counts: SidebarCounts;
  userEmail: string;
  onSignOut: () => void;
  signingOut: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: TodoFilterView;
  label: string;
  icon: typeof ListTodo;
}> = [
  { id: 'all', label: 'All Tasks', icon: ListTodo },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { id: 'high', label: 'High Priority', icon: Flag },
];

export function Sidebar({
  activeView,
  onSelectView,
  counts,
  userEmail,
  onSignOut,
  signingOut,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const completionPct =
    counts.all > 0 ? Math.round((counts.completed / counts.all) * 100) : 0;

  const content = (
    <div className="h-full flex flex-col bg-white border-r border-slate-200 w-64">
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">Cadence</span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav aria-label="Task views" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const count = counts[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`w-full min-h-[40px] px-3 py-2 rounded-md text-sm font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  isActive ? 'text-blue-700 font-semibold' : 'text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div className="pt-6 mt-6 border-t border-slate-200 px-3">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-medium">Completion</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {completionPct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 font-mono tabular-nums">
            {counts.completed} of {counts.all} completed
          </p>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200 shrink-0">
        <div className="mb-3">
          <p className="text-xs text-slate-500">Signed in as</p>
          <p className="text-sm font-medium text-slate-900 truncate" title={userEmail}>
            {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full min-h-[40px] px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
        >
          <LogOut className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}
