export interface TaskList {
  id: string;
  title: string;
  createdAt: string;
  lastModified: string;
  googleId?: string;        // Google Tasklist ID for synced lists
  googleUpdated?: string;   // Google updated timestamp for conflict detection
  isDeleted?: boolean;      // Soft delete flag for local-only changes
}