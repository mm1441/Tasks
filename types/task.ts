export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  isCompleted?: boolean;
  createdAt: string;
  lastModified: string;
  // isSynced: boolean;
  googleId?: string;         // same as id if you want to separate localId vs googleId. ToDo - when synced, change id = googleId?
  isDeleted?: boolean;       // soft delete flag for local-only changes
  notificationId?: string | null;
  tasklistId?: string;
}