import { GoogleTasksService, GoogleTask } from './googleTasks';
import type { Task } from '../types/Task';
import type { TaskList } from '../types/TaskList';

export interface SyncResult {
  success: boolean;
  tasksAdded: number;
  tasksUpdated: number;
  tasksDeleted: number;
  error?: string;
  // Extended fields for task updates
  updatedTasks?: Task[];
  addedTasks?: Task[];
  createdTasks?: Array<{ localId: string; googleId: string }>;
  deletedTasks?: string[];
  taskListGoogleId?: string;
}

export class SyncService {
  private tasksService: GoogleTasksService;

  constructor(accessToken: string) {
    this.tasksService = new GoogleTasksService(accessToken);
  }

  async syncTaskList(
    localTaskList: TaskList,
    localTasks: Task[],
    onProgress?: (message: string) => void
  ): Promise<SyncResult> {
    try {

      onProgress?.('Starting sync...');

      // Step 1: Get or create Google task list
      let googleTaskListId = localTaskList.googleId;
      console.debug(`googleTaskListId: ${googleTaskListId ?? '(none)'}`);

      if (!googleTaskListId) {
        onProgress?.('Setting up Google task list...');
        // Try to use @default list first (for first local list)
        // If that fails, create a new one
        try {
          const defaultList = await this.tasksService.getTaskList('@default');
          console.debug(`Found @default list: id=${defaultList.id}, title=${defaultList.title}`);
          googleTaskListId = defaultList.id;
        } catch {
          // Default list doesn't exist or access denied, create a new one
          const newList = await this.tasksService.createTaskList(localTaskList.title);
          console.debug(`Created new task list: id=${newList.id}, title=${newList.title}`);
          googleTaskListId = newList.id;
        }
      }

      onProgress?.('Fetching tasks from Google...');
      // Step 2: Fetch all tasks from Google
      const googleTasks = await this.tasksService.getTasks(googleTaskListId);
      console.debug(`Fetched ${googleTasks.length} tasks from Google for listId=${googleTaskListId}`);


      onProgress?.('Resolving conflicts...');
      // Step 3: Perform conflict resolution and sync
      console.debug('Resolving conflicts');
      const result = await this.performTwoWaySync(
        localTasks.filter(t => t.tasklistId === localTaskList.id),
        googleTasks,
        googleTaskListId,
        localTaskList.id,
        onProgress
      );

      // Step 4: Update task list with Google ID if needed
      if (localTaskList.googleId !== googleTaskListId) {
        // This will be handled by the caller updating the task list
        result.taskListGoogleId = googleTaskListId;
      }

      // Also need to check if this is the first list and should use @default
      // For now, we'll use the logic: if no googleId, try @default first
      if (!localTaskList.googleId) {
        try {
          const defaultList = await this.tasksService.getTaskList('@default');
          console.debug(`No google id locally; @default exists: id=${defaultList.id}, title=${defaultList.title}`);
          result.taskListGoogleId = defaultList.id;
        } catch {
          // @default doesn't exist or failed, use the created one
          console.debug('@default does not exist or is inaccessible');
        }
      }

      onProgress?.('Sync completed');

      // Log a small, readable summary rather than full objects
      const resultSummary = {
        success: result.success,
        tasksAdded: result.tasksAdded,
        tasksUpdated: result.tasksUpdated,
        tasksDeleted: result.tasksDeleted,
        addedTaskTitles: result.addedTasks?.map(t => t.title) ?? [],
        updatedTaskTitles: result.updatedTasks?.map(t => t.title) ?? [],
        deletedTaskLocalIds: result.deletedTasks ?? [],
        createdTasks: result.createdTasks ?? [],
        taskListGoogleId: result.taskListGoogleId,
      };

      console.debug('Sync completed:', resultSummary);
      return result;
    } catch (error) {
      console.error('Sync error:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        tasksAdded: 0,
        tasksUpdated: 0,
        tasksDeleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async performTwoWaySync(
    localTasks: Task[],
    googleTasks: GoogleTask[],
    googleTaskListId: string,
    localTaskListId: string,
    onProgress?: (message: string) => void
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      tasksAdded: 0,
      tasksUpdated: 0,
      tasksDeleted: 0,
      updatedTasks: [],
      addedTasks: [],
      createdTasks: [],
      deletedTasks: [],
    };
    const localTasksByGoogleId = new Map<string, Task>();
    const localTasksByLocalId = new Map<string, Task>();

    localTasks.forEach(task => {
      if (task.googleId) {
        localTasksByGoogleId.set(task.googleId, task);
      }
      localTasksByLocalId.set(task.id, task);
    });
    const googleTasksById = new Map<string, GoogleTask>();
    googleTasks.forEach(task => {
      if (task.id) {
        googleTasksById.set(task.id, task);
      }
    });

    console.debug(`Local tasks: total=${localTasks.length}, byLocalId=${localTasksByLocalId.size}, byGoogleId=${localTasksByGoogleId.size}`);
    console.debug(`Google tasks: total=${googleTasks.length}, byId=${googleTasksById.size}`);

    // Step 1: Process tasks that exist in both places (conflict resolution)
    for (const googleTask of googleTasks) {
      if (!googleTask.id) {
        console.debug(`Skipping google task with no id (title='${googleTask.title ?? ''}')`);
        continue;
      }

      const localTask = localTasksByGoogleId.get(googleTask.id);
      if (localTask) {
        console.debug(`Conflict for task id=${googleTask.id}, title='${googleTask.title ?? localTask.title}'`);
        // Task exists in both places - resolve conflict
        const localModified = new Date(localTask.lastModified).getTime();
        const googleUpdated = googleTask.updated ? new Date(googleTask.updated).getTime() : 0;

        if (googleUpdated > localModified) {
          // Cloud is newer - update local
          console.debug(`Cloud is newer for '${googleTask.title}': cloudUpdated=${googleTask.updated}, localModified=${localTask.lastModified}`);
          onProgress?.(`Updating local task: ${googleTask.title}`);
          result.tasksUpdated++;
          // The caller will update the local task - preserve local ID
          result.updatedTasks!.push(
            GoogleTasksService.googleTaskToLocalTask(googleTask, localTask.tasklistId || '', localTask.id)
          );
        } else if (localModified > googleUpdated) {
          // Local is newer - update cloud
          console.debug(`Local is newer for '${localTask.title}': localModified=${localTask.lastModified}, cloudUpdated=${googleTask.updated}`);
          onProgress?.(`Updating cloud task: ${localTask.title}`);
          try {
            const patch = GoogleTasksService.localTaskToGoogleTaskPatch(localTask);
            console.debug(
              `Patching cloud task '${localTask.title}' with fields:`,
              Object.keys(patch)
            );
            await this.tasksService.updateTask(googleTaskListId, googleTask.id, patch);
            result.tasksUpdated++;
          } catch (error) {
            console.error(`Failed to update Google task ${googleTask.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        // If timestamps are equal, no update needed
      }
    }

    // Step 2: Add tasks that only exist in Google to local
    for (const googleTask of googleTasks) {
      if (!googleTask.id) {
        console.debug(`Skipping google task with no id during add step (title='${googleTask.title ?? ''}')`);
        continue;
      }
      if (!localTasksByGoogleId.has(googleTask.id)) {
        console.debug(`Adding task from cloud: id=${googleTask.id}, title='${googleTask.title ?? ''}'`);
        onProgress?.(`Adding task from cloud: ${googleTask.title}`);
        result.tasksAdded++;
        result.addedTasks!.push(
          GoogleTasksService.googleTaskToLocalTask(googleTask, localTaskListId)
        );
      }
    }

    // Step 3: Add tasks that only exist locally to Google
    for (const localTask of localTasks) {
      if (!localTask.googleId && !localTask.isDeleted) {
        onProgress?.(`Uploading local task: ${localTask.title}`);
        console.debug(`Uploading local task: localId=${localTask.id}, title='${localTask.title}'`);
        try {
          const googleTask = GoogleTasksService.localTaskToGoogleTask(localTask);
          console.debug(`Converted local -> google: title='${googleTask.title}', id='${googleTask.id ?? ''}'`);
          const created = await this.tasksService.createTask(googleTaskListId, googleTask);
          console.debug(`Created remote task: id=${created.id ?? '(none)'}, title='${created.title ?? localTask.title}'`);
          result.tasksAdded++;
          result.createdTasks!.push({
            localId: localTask.id,
            googleId: created.id || '',
          });
        } catch (error) {
          console.error(`Failed to create Google task for localId=${localTask.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Step 4: Handle deletions (tasks marked as deleted locally)
    for (const localTask of localTasks) {
      if (localTask.isDeleted && localTask.googleId) {
        onProgress?.(`Deleting task from cloud: ${localTask.title}`);
        try {
          console.debug(`Requesting delete for googleId=${localTask.googleId}, localId=${localTask.id}`);
          await this.tasksService.deleteTask(googleTaskListId, localTask.googleId);
          result.tasksDeleted++;
        } catch (error) {
          console.error(`Failed to delete Google task ${localTask.googleId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Step 5: Handle tasks deleted on Google (exist locally but not in Google)
    const localGoogleIds = new Set(
      localTasks.filter(t => t.googleId).map(t => t.googleId!)
    );
    for (const googleTaskId of localGoogleIds) {
      if (!googleTasksById.has(googleTaskId)) {
        // Task was deleted on Google, mark as deleted locally
        const localTask = localTasksByGoogleId.get(googleTaskId);
        if (localTask && !localTask.isDeleted) {
          onProgress?.(`Task deleted on cloud: ${localTask.title}`);
          result.tasksDeleted++;
          result.deletedTasks!.push(localTask.id);
        }
      }
    }

    return result;
  }
}