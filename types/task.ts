export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  createdAt: string;
  lastModified: string;
  // isSynced: boolean;
  googleId?: string;         // same as id if you want to separate localId vs googleId. ToDo - when synced, change id = googleId?
  googleUpdated?: string;    // save Google `updated` for conflict detection
  tasklistId?: string;       // which Google Tasklist this belongs to
  isDeleted?: boolean;       // soft delete flag for local-only changes
}