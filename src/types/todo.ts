export type TodoPriority = 'low' | 'medium' | 'high';

export type TodoStatus = 'pending' | 'completed';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: TodoPriority;
  due_date: string | null;
  status: TodoStatus;
  created_at: string;
  updated_at?: string | null;
}

export interface TodoInput {
  title: string;
  description: string;
  priority: TodoPriority;
  due_date: string | null;
  status?: TodoStatus;
}

export type TodoFilterView = 'all' | 'pending' | 'completed' | 'overdue' | 'high';

export type TodoSortOption = 'newest' | 'due_date' | 'priority';
