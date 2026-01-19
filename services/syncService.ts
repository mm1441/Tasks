import { GoogleTasksService, GoogleTask } from './GoogleTasks';
import type { Task } from '../types/Task';
import type { TaskList } from '../types/TaskList';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';


export interface SyncResult {
  success: boolean;
  tasksAdded: number;
  tasksUpdated: number;
  tasksDeleted: number;
  error?: string;
  updatedTasks?: Task[];
  addedTasks?: Task[];
  createdTasks?: Array<{ localId: string; googleId: string }>;
  deletedTasks?: string[];
  taskListGoogleId?: string;
}
export interface TaskListReconcileResult {
  addedTaskLists?: TaskList[]; // cloud → local (create these locally)
  createdTaskLists?: Array<{ localId: string; googleId: string }>; // local → cloud (persist googleId locally)
  linkedTaskLists?: Array<{ localId: string; googleId: string }>; // local lists matched to cloud list by title
  success: boolean;
  error?: string;
}

export class SyncService {
  private tasksService: GoogleTasksService;

  constructor(accessToken: string) {
    this.tasksService = new GoogleTasksService(accessToken);
  }

  async download(
    localTaskList: TaskList,
    localTasks: Task[],
    onProgress?: (message: string) => void
  ): Promise<SyncResult> {

    const result: SyncResult = {
      success: true,
      tasksAdded: 0,
      tasksUpdated: 0,
      tasksDeleted: 0,
      addedTasks: [],
      updatedTasks: [],
      deletedTasks: [],
    };

    const googleTaskListId = await this.resolveGoogleTaskList(localTaskList);
    result.taskListGoogleId = googleTaskListId;

    onProgress?.('Fetching tasks from Google...');
    const googleTasks = await this.tasksService.getTasks(googleTaskListId);

    const localByGoogleId = new Map(
      localTasks.filter(t => t.googleId).map(t => [t.googleId!, t])
    );
    const googleById = new Map(googleTasks.filter(t => t.id).map(t => [t.id!, t]));

    for (const googleTask of googleTasks) {
      if (!googleTask.id) continue;
      const localTask = localByGoogleId.get(googleTask.id);
      if (!localTask) {
        result.tasksAdded++;
        result.addedTasks!.push(
          GoogleTasksService.googleTaskToLocalTask(googleTask, localTaskList.id)
        );
      } else {
        const localModified = new Date(localTask.lastModified).getTime();
        const googleUpdated = googleTask.updated ? new Date(googleTask.updated).getTime() : 0;
        if (googleUpdated > localModified) {
          result.tasksUpdated++;
          result.updatedTasks!.push(
            GoogleTasksService.googleTaskToLocalTask(googleTask, localTaskList.id, localTask.id)
          );
        }
      }
    }

    for (const localTask of localTasks) {
      if (localTask.googleId && !googleById.has(localTask.googleId) && !localTask.isDeleted) {
        result.tasksDeleted++;
        result.deletedTasks!.push(localTask.id);
      }
    }

    return result;
  }

  async upload(
    localTaskList: TaskList,
    localTasks: Task[],
    onProgress?: (message: string) => void
  ): Promise<SyncResult> {

    const result: SyncResult = {
      success: true,
      tasksAdded: 0,
      tasksUpdated: 0,
      tasksDeleted: 0,
      createdTasks: [],
    };

    // Ensure we have a valid cloud list id (resolve or create)
    const googleTaskListId = await this.ensureGoogleTaskList(localTaskList, onProgress);
    result.taskListGoogleId = googleTaskListId;

    onProgress?.('Uploading local changes to Google...');
    const googleTasks = await this.tasksService.getTasks(googleTaskListId);
    const googleById = new Map(googleTasks.filter(t => t.id).map(t => [t.id!, t]));

    localTasks = localTasks.filter((t) => !t.isDeleted)
    // 1) Create remote tasks for local tasks without googleId
    for (const localTask of localTasks) {
      if (localTask.isDeleted) continue;

      if (!localTask.googleId) {
        onProgress?.(`Creating remote task: ${localTask.title}`);
        try {
          // Use the create-specific payload that guarantees title is present
          const createPayload = GoogleTasksService.localTaskToGoogleTask(localTask);
          // ensure we don't accidentally include id/updated
          delete (createPayload as any).id;
          delete (createPayload as any).updated;

          console.debug('Creating remote task payload:', createPayload);
          const created = await this.tasksService.createTask(googleTaskListId, createPayload as any);
          result.tasksAdded++;
          if (created.id) result.createdTasks!.push({ localId: localTask.id, googleId: created.id });
        } catch (err) {
          console.error(`Failed to create Google task for localId=${localTask.id}:`, err);
        }
      }
    }

    // 2) Delete remote tasks for local tasks marked isDeleted
    for (const localTask of localTasks) {
      if (localTask.isDeleted && localTask.googleId) {
        onProgress?.(`Deleting remote task: ${localTask.title}`);
        try {
          await this.tasksService.deleteTask(googleTaskListId, localTask.googleId);
          result.tasksDeleted++;
        } catch (err) {
          console.error(`Failed to delete remote task ${localTask.googleId}:`, err);
        }
      }
    }

    // 3) Update remote tasks where local is newer
    for (const localTask of localTasks) {
      if (!localTask.googleId || localTask.isDeleted) continue;

      const googleTask = googleById.get(localTask.googleId);
      if (!googleTask) {
        // remote missing — we treat this as deletion on cloud (caller policy),
        // or you could choose to re-create it here.
        continue;
      }

      const localModified = new Date(localTask.lastModified).getTime();
      const googleUpdated = googleTask.updated ? new Date(googleTask.updated).getTime() : 0;
      if (localModified > googleUpdated) {
        onProgress?.(`Updating remote task: ${localTask.title}`);
        try {
          const patch = GoogleTasksService.localTaskToGoogleTaskPatch(localTask);
          await this.tasksService.updateTask(googleTaskListId, localTask.googleId, patch as any);
          result.tasksUpdated++;
        } catch (err) {
          console.error(`Failed to update Google task ${localTask.googleId}:`, err);
        }
      }
    }
    return result;
  }

  async reconcileTaskLists(
    localTaskLists: TaskList[],
    onProgress?: (message: string) => void
  ): Promise<TaskListReconcileResult> {
    try {
      onProgress?.('Fetching task lists from Google...');
      const cloudLists = await this.tasksService.getTaskLists();

      // Build lookup maps
      const cloudById = new Map<string, { id: string; title?: string; updated?: string }>(
        cloudLists.filter(c => c.id).map(c => [c.id, c])
      );
      const cloudByTitle = new Map<string, { id: string; title?: string; updated?: string }>();
      cloudLists.forEach(c => {
        const key = (c.title || '').trim().toLowerCase();
        if (key && !cloudByTitle.has(key)) cloudByTitle.set(key, c);
      });

      const localByGoogleId = new Map<string, TaskList>();
      const localByTitle = new Map<string, TaskList>();
      localTaskLists.forEach(l => {
        if (l.googleId) localByGoogleId.set(l.googleId, l);
        const key = (l.title || '').trim().toLowerCase();
        if (key && !localByTitle.has(key)) localByTitle.set(key, l);
      });

      const addedTaskLists: TaskList[] = []; // cloud -> local
      const createdTaskLists: Array<{ localId: string; googleId: string }> = []; // local -> cloud
      const linkedTaskLists: Array<{ localId: string; googleId: string }> = []; // title linkings

      // 1) Cloud lists that are not present locally -> create local empty TaskList
      for (const cloud of cloudLists) {
        if (!cloud.id) continue;
        // If there's a local list already linked to this cloud id, skip
        if (localByGoogleId.has(cloud.id)) continue;

        // If a local list exists with the same title, link instead of creating
        const titleKey = (cloud.title || '').trim().toLowerCase();
        const localMatch = titleKey ? localByTitle.get(titleKey) : undefined;
        if (localMatch) {
          // local exists with same title but maybe no googleId -> link
          if (!localMatch.googleId) {
            linkedTaskLists.push({ localId: localMatch.id, googleId: cloud.id });
          }
          continue;
        }

        // No local match -> create a new empty local TaskList representation
        const now = cloud.updated || new Date().toISOString();
        const newLocal: TaskList = {
          id: uuidv4(),
          title: cloud.title || 'Untitled',
          createdAt: now,
          lastModified: now,
          googleId: cloud.id,
          googleUpdated: cloud.updated,
        };
        addedTaskLists.push(newLocal);
      }

      // 2) Local lists missing on cloud -> create empty cloud task list
      for (const local of localTaskLists) {
        // If local already has googleId and exists on cloud, skip
        if (local.googleId && cloudById.has(local.googleId)) continue;

        const titleKey = (local.title || '').trim().toLowerCase();
        const cloudMatch = titleKey ? cloudByTitle.get(titleKey) : undefined;

        if (cloudMatch) {
          // Found cloud list by title -> link
          linkedTaskLists.push({ localId: local.id, googleId: cloudMatch.id });
          continue;
        }

        // No cloud match -> create on Google
        try {
          onProgress?.(`Creating cloud task list: ${local.title}`);
          const created = await this.tasksService.createTaskList(local.title);
          if (created && created.id) {
            createdTaskLists.push({ localId: local.id, googleId: created.id });
          }
        } catch (err) {
          console.error(`Failed to create cloud list for local '${local.title}':`, err);
          // don't fail entire reconcile: continue with others
        }
      }

      return {
        success: true,
        addedTaskLists: addedTaskLists.length ? addedTaskLists : undefined,
        createdTaskLists: createdTaskLists.length ? createdTaskLists : undefined,
        linkedTaskLists: linkedTaskLists.length ? linkedTaskLists : undefined,
      };
    } catch (error) {
      console.error('reconcileTaskLists error', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }


  private async resolveGoogleTaskList(localTaskList: TaskList): Promise<string> {
    if (localTaskList.googleId) return localTaskList.googleId;
    try {
      const def = await this.tasksService.getTaskList('@default');
      return def.id!;
    } catch {
      const created = await this.tasksService.createTaskList(localTaskList.title);
      return created.id!;
    }
  }

  private async ensureGoogleTaskList(
    localTaskList: TaskList,
    onProgress?: (message: string) => void
  ): Promise<string> {
    // Fetch cloud lists once (avoid multiple API calls)
    onProgress?.('Fetching Google task lists...');
    const cloudLists = await this.tasksService.getTaskLists();

    // 1) If local already has googleId and it exists on cloud -> use it
    if (localTaskList.googleId) {
      const found = cloudLists.find(gl => gl.id === localTaskList.googleId);
      if (found && found.id) {
        onProgress?.('Using existing cloud task list.');
        return found.id;
      }
      // googleId present but not found -> continue to try title matching
      console.warn(`Local googleId ${localTaskList.googleId} not present in cloud lists; will try title match.`);
    }

    // 2) Match by title (case-insensitive) to avoid duplicates
    const titleKey = (localTaskList.title || '').trim().toLowerCase();
    if (titleKey) {
      const match = cloudLists.find(gl => (gl.title || '').trim().toLowerCase() === titleKey);
      if (match && match.id) {
        onProgress?.(`Found cloud list by title: ${match.title}`);
        return match.id;
      }
    }

    // 3) No match -> create a new cloud list using the local title
    try {
      onProgress?.('Creating new Google task list...');
      const created = await this.tasksService.createTaskList(localTaskList.title || 'Tasks');
      onProgress?.(`Created Google list: ${created.title || created.id}`);
      return created.id!;
    } catch (err) {
      console.error('Failed to create Google task list:', err);
      throw new Error('Failed to create or resolve Google task list');
    }
  }

}


/* Taks Context:
  const result = await syncService.reconcileTaskLists(taskLists, (m) => console.log(m));

// Add cloud-only lists to local state
if (result.addedTaskLists) {
  setTaskLists(prev => [...prev, ...result.addedTaskLists!]);
}

// Update local lists that were created remotely
if (result.createdTaskLists) {
  setTaskLists(prev => prev.map(tl => {
    const mapping = result.createdTaskLists!.find(c => c.localId === tl.id);
    if (mapping) {
      return { ...tl, googleId: mapping.googleId, googleUpdated: new Date().toISOString() };
    }
    return tl;
  }));
}

// For linked lists found by title, set googleId (do this too)
if (result.linkedTaskLists) {
  setTaskLists(prev => prev.map(tl => {
    const mapping = result.linkedTaskLists!.find(c => c.localId === tl.id);
    if (mapping) {
      return { ...tl, googleId: mapping.googleId, googleUpdated: new Date().toISOString() };
    }
    return tl;
  }));
}

*/