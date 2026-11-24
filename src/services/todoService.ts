import { supabase } from '../lib/supabase';
import type { Todo, TodoInput, TodoPriority, TodoStatus } from '../types/todo';

type CompletionColumn = 'status' | 'is_completed' | 'completed';

interface DetectedSchema {
  completionColumn: CompletionColumn | null;
  hasUpdatedAt: boolean | null;
  priorityTitleCase: boolean;
}

const detectedSchema: DetectedSchema = {
  completionColumn: null,
  hasUpdatedAt: null,
  priorityTitleCase: false,
};

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your environment.'
    );
  }
  return supabase;
}

function normalizePriority(rawPriority: unknown): TodoPriority {
  if (typeof rawPriority !== 'string') return 'medium';
  const lower = rawPriority.trim().toLowerCase();
  if (rawPriority === 'High' || rawPriority === 'Medium' || rawPriority === 'Low') {
    detectedSchema.priorityTitleCase = true;
  }
  if (lower === 'high' || lower === 'urgent') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

function formatPriorityForDb(priority: TodoPriority): string {
  if (detectedSchema.priorityTitleCase) {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
  return priority;
}

function normalizeStatus(raw: Record<string, unknown>): TodoStatus {
  if ('status' in raw) {
    detectedSchema.completionColumn = 'status';
    return String(raw.status ?? '').toLowerCase() === 'completed' ? 'completed' : 'pending';
  }
  if ('is_completed' in raw) {
    detectedSchema.completionColumn = 'is_completed';
    return raw.is_completed ? 'completed' : 'pending';
  }
  if ('completed' in raw) {
    detectedSchema.completionColumn = 'completed';
    return raw.completed ? 'completed' : 'pending';
  }
  return 'pending';
}

function normalizeDueDate(rawDueDate: unknown): string | null {
  if (typeof rawDueDate !== 'string' || !rawDueDate.trim()) {
    return null;
  }
  return rawDueDate.slice(0, 10);
}

function normalizeRow(raw: Record<string, unknown>): Todo {
  if ('updated_at' in raw) {
    detectedSchema.hasUpdatedAt = true;
  }
  const status = normalizeStatus(raw);
  const priority = normalizePriority(raw.priority);

  return {
    id: String(raw.id),
    user_id: String(raw.user_id ?? ''),
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    priority,
    due_date: normalizeDueDate(raw.due_date),
    status,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

function buildCompletionField(column: CompletionColumn, status: TodoStatus): Record<string, unknown> {
  if (column === 'status') {
    return { status };
  }
  if (column === 'is_completed') {
    return { is_completed: status === 'completed' };
  }
  return { completed: status === 'completed' };
}

function isColumnMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    Boolean(error.message?.toLowerCase().includes('column'))
  );
}

function isPriorityConstraintError(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('priority') && (msg.includes('check') || msg.includes('constraint'));
}

export async function fetchTodos(userId: string): Promise<Todo[]> {
  const client = requireClient();

  const { data, error } = await client
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to fetch tasks from Supabase.');
  }

  return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
}

export async function createTodo(userId: string, input: TodoInput): Promise<Todo> {
  const client = requireClient();
  const title = input.title.trim();
  if (!title) {
    throw new Error('Task title is required.');
  }

  const desiredStatus: TodoStatus = input.status ?? 'pending';
  const basePayload: Record<string, unknown> = {
    user_id: userId,
    title,
    description: input.description.trim() || null,
    priority: formatPriorityForDb(input.priority),
    due_date: input.due_date || null,
  };

  if (detectedSchema.completionColumn) {
    Object.assign(basePayload, buildCompletionField(detectedSchema.completionColumn, desiredStatus));
  }

  let result = await client.from('todos').insert(basePayload).select('*').single();

  if (result.error) {
    if (isPriorityConstraintError(result.error)) {
      detectedSchema.priorityTitleCase = !detectedSchema.priorityTitleCase;
      basePayload.priority = formatPriorityForDb(input.priority);
      result = await client.from('todos').insert(basePayload).select('*').single();
    }

    if (result.error && result.error.message) {
      const errMsg = result.error.message.toLowerCase();
      const candidateColumns: CompletionColumn[] = ['status', 'is_completed', 'completed'];
      for (const col of candidateColumns) {
        if (errMsg.includes(col)) {
          detectedSchema.completionColumn = col;
          const retryPayload = {
            ...basePayload,
            ...buildCompletionField(col, desiredStatus),
          };
          result = await client.from('todos').insert(retryPayload).select('*').single();
          break;
        }
      }
    }
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message || 'Failed to create task in Supabase.');
  }

  return normalizeRow(result.data as Record<string, unknown>);
}

export async function updateTodo(
  userId: string,
  todoId: string,
  updates: Partial<TodoInput>
): Promise<Todo> {
  const client = requireClient();

  const payload: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed) {
      throw new Error('Task title cannot be empty.');
    }
    payload.title = trimmed;
  }

  if (updates.description !== undefined) {
    payload.description = updates.description.trim() || null;
  }

  if (updates.priority !== undefined) {
    payload.priority = formatPriorityForDb(updates.priority);
  }

  if (updates.due_date !== undefined) {
    payload.due_date = updates.due_date || null;
  }

  if (detectedSchema.hasUpdatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  if (updates.status !== undefined) {
    const columnsToTry: CompletionColumn[] = detectedSchema.completionColumn
      ? [detectedSchema.completionColumn]
      : ['status', 'is_completed', 'completed'];

    let lastError: { message?: string } | null = null;
    for (const col of columnsToTry) {
      let attemptPayload: Record<string, unknown> = {
        ...payload,
        ...buildCompletionField(col, updates.status),
      };
      let attempt = await client
        .from('todos')
        .update(attemptPayload)
        .eq('id', todoId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (attempt.error && updates.priority !== undefined && isPriorityConstraintError(attempt.error)) {
        detectedSchema.priorityTitleCase = !detectedSchema.priorityTitleCase;
        attemptPayload = {
          ...attemptPayload,
          priority: formatPriorityForDb(updates.priority),
        };
        attempt = await client
          .from('todos')
          .update(attemptPayload)
          .eq('id', todoId)
          .eq('user_id', userId)
          .select('*')
          .single();
      }

      if (!attempt.error && attempt.data) {
        detectedSchema.completionColumn = col;
        return normalizeRow(attempt.data as Record<string, unknown>);
      }

      lastError = attempt.error;
      if (!isColumnMissingError(attempt.error)) {
        break;
      }
    }

    throw new Error(lastError?.message || 'Failed to update task in Supabase.');
  }

  let result = await client
    .from('todos')
    .update(payload)
    .eq('id', todoId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (result.error && updates.priority !== undefined && isPriorityConstraintError(result.error)) {
    detectedSchema.priorityTitleCase = !detectedSchema.priorityTitleCase;
    payload.priority = formatPriorityForDb(updates.priority);
    result = await client
      .from('todos')
      .update(payload)
      .eq('id', todoId)
      .eq('user_id', userId)
      .select('*')
      .single();
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message || 'Failed to update task in Supabase.');
  }

  return normalizeRow(result.data as Record<string, unknown>);
}

export async function deleteTodo(userId: string, todoId: string): Promise<void> {
  const client = requireClient();

  const { data, error } = await client
    .from('todos')
    .delete()
    .eq('id', todoId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    throw new Error(error.message || 'Failed to delete task from Supabase.');
  }

  if (!data || data.length === 0) {
    throw new Error('Task could not be deleted or you do not have permission.');
  }
}
