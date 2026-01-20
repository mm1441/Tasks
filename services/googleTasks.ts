import type { Task } from '../types/Task';
import type { TaskList } from '../types/TaskList';

const GOOGLE_TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

export interface GoogleTask {
  id?: string;
  title: string;
  notes?: string;
  status?: 'needsAction' | 'completed';
  due?: string; // RFC3339 format
  updated?: string; // RFC3339 format
  position?: string;
  parent?: string;
}

export type GoogleTaskCreate = {
  title: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
};
export type GoogleTaskPatch = Partial<GoogleTaskCreate>;


export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string; // RFC3339 format
}

export class GoogleTasksService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GOOGLE_TASKS_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Tasks API error: ${response.status} - ${errorText}`);
    }

    // Some Google Tasks endpoints (DELETE) return an empty body.
    // Attempt to read the response text and parse JSON only when there's content.
    const text = await response.text();
    if (!text) {
      // No content to parse (204 or empty body)
      // Return undefined casted to T so callers expecting void/undefined work fine.
      return undefined as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      // If parsing fails, return the raw text casted to T as a fallback
      return text as unknown as T;
    }
  }

  // Task Lists
  async getTaskLists(): Promise<GoogleTaskList[]> {
    const response = await this.apiRequest<{ items: GoogleTaskList[] }>('/users/@me/lists');
    return response.items || [];
  }

  async getTaskList(taskListId: string): Promise<GoogleTaskList> {
    return this.apiRequest<GoogleTaskList>(`/users/@me/lists/${taskListId}`);
  }

  async createTaskList(title: string): Promise<GoogleTaskList> {
    return this.apiRequest<GoogleTaskList>('/users/@me/lists', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async updateTaskList(taskListId: string, title: string): Promise<GoogleTaskList> {
    return this.apiRequest<GoogleTaskList>(`/users/@me/lists/${taskListId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  async deleteTaskList(taskListId: string): Promise<void> {
    await this.apiRequest(`/users/@me/lists/${taskListId}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks(taskListId: string): Promise<GoogleTask[]> {
    const response = await this.apiRequest<{ items: GoogleTask[] }>(
      `/lists/${taskListId}/tasks?showCompleted=true&showHidden=true`
    );
    return response.items || [];
  }

  async getTask(taskListId: string, taskId: string): Promise<GoogleTask> {
    return this.apiRequest<GoogleTask>(`/lists/${taskListId}/tasks/${taskId}`);
  }

  async createTask(taskListId: string, task: GoogleTask): Promise<GoogleTask> {
    return this.apiRequest<GoogleTask>(`/lists/${taskListId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(taskListId: string, taskId: string, task: Partial<GoogleTask>): Promise<GoogleTask> {
    return this.apiRequest<GoogleTask>(`/lists/${taskListId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    });
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    await this.apiRequest(`/lists/${taskListId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  // Conversion helpers
  static googleTaskToLocalTask(googleTask: GoogleTask, taskListId: string, existingLocalId?: string): Task {
    return {
      id: existingLocalId || googleTask.id || '', // Double check this shi
      title: googleTask.title,
      description: googleTask.notes || undefined,
      dueDate: googleTask.due || null,
      isCompleted: googleTask.status === 'completed',
      createdAt: googleTask.updated || new Date().toISOString(),
      lastModified: googleTask.updated || new Date().toISOString(),
      googleId: googleTask.id,
      tasklistId: taskListId,
      notificationId: null,
    };
  }

  static localTaskToGoogleTask(task: Task): GoogleTaskCreate {
    const payload: GoogleTaskCreate = {
      title: task.title,
      notes: task.description && task.description.trim().length > 0 ? task.description : undefined,
      status: task.isCompleted ? 'completed' : 'needsAction',
    };
    // Convert to RFC3339 (toISOString)
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        payload.due = d.toISOString();
      } else {
        console.warn('Invalid dueDate for task', task.id, task.dueDate);
      }
    }
    return payload;
  }

  static localTaskToGoogleTaskCreate(task: Task): GoogleTaskCreate {
    const payload: GoogleTaskCreate = {
      title: task.title,
      status: task.isCompleted ? 'completed' : 'needsAction',
    };

    if (task.description?.trim()) {
      payload.notes = task.description;
    }

    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        payload.due = d.toISOString();
      }
    }

    return payload;
  }

  static localTaskToGoogleTaskPatch(task: Task): GoogleTaskPatch {
    return this.localTaskToGoogleTaskCreate(task);
  }

  static googleTaskListToLocalTaskList(googleTaskList: GoogleTaskList): TaskList {
    return {
      id: googleTaskList.id, // Triple check this shi
      title: googleTaskList.title,
      createdAt: googleTaskList.updated || new Date().toISOString(),
      lastModified: googleTaskList.updated || new Date().toISOString(),
      googleId: googleTaskList.id,
      googleUpdated: googleTaskList.updated,
    };
  }
}