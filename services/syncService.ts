// SyncService.ts
import { GoogleTasksService, GoogleTask, GoogleTaskList } from './GoogleTasks';
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
  updatedTasks?: Task[]; // cloud -> local updates
  addedTasks?: Task[];   // cloud -> local new tasks
  createdTasks?: Array<{ localId: string; googleId: string }>; // local -> cloud created tasks
  deletedTasks?: string[]; // local ids that should be marked deleted (cloud removed)
  taskListGoogleId?: string;
  // Reconcile results for lists
  addedTaskLists?: TaskList[]; // cloud -> local (empty lists)
  createdTaskLists?: Array<{ localId: string; googleId: string }>; // local -> cloud list created
  linkedTaskLists?: Array<{ localId: string; googleId: string }>; // suggestions to link by title
  updatedTaskLists?: Array<{ localId: string; title: string; googleId: string; googleUpdated?: string }>;
}

type RenameOrDeleteResult =
  | { kind: 'ok', cloud?: GoogleTaskList }            // matched normally
  | { kind: 'cloud-renamed', cloud: GoogleTaskList } // cloud has a different id but same/similar title
  | { kind: 'cloud-deleted', lastCloudUpdate?: number } // cloud list is missing
  ;

export class SyncService {
  private tasksService: GoogleTasksService;

  constructor(accessToken: string) {
    this.tasksService = new GoogleTasksService(accessToken);
  }

  // ---------- Public: download (cloud -> local)
  // - ensure we fetch all cloud lists, create local empty lists for cloud-only lists
  // - download tasks only for the provided localTaskList (current list)
  async download(
    localTaskList: TaskList,
    localTasks: Task[],
    localTaskLists: TaskList[],
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
      createdTasks: [],
    };

    try {
      onProgress?.('Fetching cloud task lists...');
      const cloudLists = await this.tasksService.getTaskLists();

      // before the for loop ensure arrays exist
      const updatedTaskLists: Array<{ localId: string; title: string; googleId: string; googleUpdated?: string }> = [];
      const createdTaskLists: Array<{ localId: string; googleId: string }> = [];
      const linkedTaskListsAcc: Array<{ localId: string; googleId: string }> = [];

      for (const localList of localTaskLists) {
        const res = await this.handleListRenameOrDelete(localList, cloudLists, onProgress);

        if (res.action === 'update-local-title' && res.cloudId) {
          // find the cloud object to read its title/updated
          const cloudObj = cloudLists.find(c => c.id === res.cloudId);
          if (cloudObj) {
            updatedTaskLists.push({
              localId: localList.id,
              title: cloudObj.title ?? localList.title,
              googleId: cloudObj.id,
              googleUpdated: cloudObj.updated,
            });
          } else {
            // cloud id provided but object not in snapshot => safe fallback
            updatedTaskLists.push({
              localId: localList.id,
              title: localList.title,
              googleId: res.cloudId,
            });
          }
          // also update in-memory snapshot so subsequent logic sees it
          if (cloudObj) cloudLists.push(cloudObj);
          continue;
        }

        if (res.action === 'mark-local-deleted') {
          // provider will apply isDeleted flag for this list
          // we can reuse createdTaskLists/linkedTaskLists arrays or add a new field; for simplicity:
          // mark as linked? no — add to updatedTaskLists with special title? Better add to result.linkedTaskLists? 
          // We'll add a simple mapping for mark-local-deleted:
          // result.createdTaskLists?? = ... not appropriate; instead push to linkedTaskListsAcc for provider to examine.
          // But for clarity, push to updatedTaskLists with title = '' + flag handled in provider.
          updatedTaskLists.push({
            localId: localList.id,
            title: localList.title,
            googleId: '',
          });
          continue;
        }

        if (res.action === 'recreate-cloud') {
          // create on cloud and return mapping for provider to persist googleId
          const created = await this.tasksService.createTaskList(localList.title);
          if (created && created.id) {
            createdTaskLists.push({ localId: localList.id, googleId: created.id });
            // merge into snapshot so other checks see it
            cloudLists.push({ id: created.id, title: created.title ?? localList.title, updated: created.updated });
          }
          continue;
        }

        // noop -> nothing to do
      }

      // attach to result so provider receives them
      if (updatedTaskLists.length) result.updatedTaskLists = updatedTaskLists;
      if (createdTaskLists.length) result.createdTaskLists = createdTaskLists;
      if (linkedTaskListsAcc.length) result.linkedTaskLists = linkedTaskListsAcc;


      // Reconcile lists: 1) any cloud lists missing locally => create empty local entries
      const { addedTaskLists, linkedTaskLists } = this.reconcileCloudToLocalLists(localTaskList, cloudLists);
      if (addedTaskLists.length) {
        result.addedTaskLists = addedTaskLists;
        onProgress?.(`Found ${addedTaskLists.length} cloud task list(s) missing locally`);
      }
      if (linkedTaskLists.length) {
        result.linkedTaskLists = linkedTaskLists;
      }

      // Resolve the googleTaskListId for the current local list (prefer googleId, match by title, fallback create)
      const googleTaskListId = await this.resolveOrCreateGoogleListFromCloud(localTaskList, cloudLists, onProgress);
      result.taskListGoogleId = googleTaskListId;

      // Fetch tasks for this list
      onProgress?.('Fetching tasks from Google for current list...');
      const googleTasks = await this.tasksService.getTasks(googleTaskListId);
      onProgress?.(`Fetched ${googleTasks.length} tasks from Google`);

      // Build maps for efficient diffing
      const localByGoogleId = new Map(localTasks.filter(t => t.googleId).map(t => [t.googleId!, t]));
      const googleById = new Map(googleTasks.filter(t => t.id).map(t => [t.id!, t]));

      // 1) cloud-only tasks => add locally
      for (const g of googleTasks) {
        if (!g.id) continue;
        const local = localByGoogleId.get(g.id);

        if (!local) {
          // No local copy -> add from cloud
          result.tasksAdded++;
          result.addedTasks!.push(GoogleTasksService.googleTaskToLocalTask(g, localTaskList.id));
          continue;
        }

        // We have a local copy.
        // If local is marked deleted, decide by timestamps:
        if (local.isDeleted) {
          const localDeletedTime = new Date(local.lastModified).getTime();
          const googleUpdated = g.updated ? new Date(g.updated).getTime() : 0;

          if (localDeletedTime > googleUpdated) {
            // Local delete is newer than cloud update -> keep local deletion (do NOT resurrect)
            // Optionally ensure upload will delete remote by including this local in upload queue.
            continue;
          } else {
            // Cloud is newer -> resurrect/restore from cloud (cloud wins)
            result.tasksUpdated++;
            result.updatedTasks!.push(
              GoogleTasksService.googleTaskToLocalTask(g, localTaskList.id, local.id)
            );
            continue;
          }
        }

        // Normal conflict-resolution when local is not deleted:
        const localModified = new Date(local.lastModified).getTime();
        const googleUpdated = g.updated ? new Date(g.updated).getTime() : 0;
        if (googleUpdated > localModified) {
          result.tasksUpdated++;
          result.updatedTasks!.push(GoogleTasksService.googleTaskToLocalTask(g, localTaskList.id, local.id));
        }
      }

      // 2) local tasks that have googleId but missing on cloud -> mark deleted locally
      // Only consider tasks that belong to the current localTaskList
      const currentLocalTasks = localTasks.filter(t => t.tasklistId === localTaskList.id);

      const listGoogleUpdatedTime = localTaskList.googleUpdated ? new Date(localTaskList.googleUpdated).getTime() : 0;

      for (const local of currentLocalTasks) {
        if (!local.googleId) continue;
        if (local.isDeleted) continue;

        // If the local task was modified after the last-known cloud update for this list,
        // prefer local change (do not mark deleted here — upload will handle remote create/update).
        const localModified = local.lastModified ? new Date(local.lastModified).getTime() : 0;
        if (localModified > listGoogleUpdatedTime) {
          // local change is newer than the last known cloud snapshot — skip deletion.
          continue;
        }

        // If remote does not contain this googleId, cloud has removed it (or it's in another list).
        if (!googleById.has(local.googleId)) {
          result.tasksDeleted++;
          result.deletedTasks!.push(local.id); // caller will mark isDeleted = true locally
        }
      }


      return result;
    } catch (err) {
      console.error('download error', err);
      return {
        success: false,
        tasksAdded: 0,
        tasksUpdated: 0,
        tasksDeleted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------- Public: upload (local -> cloud)
  // - ensure we fetch cloud lists, create cloud lists for local-only lists
  // - upload tasks only for the provided localTaskList
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
    
    try {
      onProgress?.('Fetching cloud task lists...');
      const cloudLists = await this.tasksService.getTaskLists();

      // ----- Handle local list rename (local -> cloud)
      const cloudList = cloudLists.find(c => c.id === localTaskList.googleId);
      if (cloudList) {
        const localModified = new Date(localTaskList.lastModified).getTime();
        const cloudUpdated = cloudList.updated
          ? new Date(cloudList.updated).getTime()
          : 0;

        const titlesDiffer =
          (localTaskList.title ?? '').trim() !== (cloudList.title ?? '').trim();

        if (titlesDiffer && localModified > cloudUpdated) {
          onProgress?.(`Updating cloud list title to '${localTaskList.title}'`);
          try {
            const updated = await this.tasksService.updateTaskList(
              cloudList.id!,
              localTaskList.title
            );

            // update in-memory snapshot
            cloudList.title = updated.title;
            cloudList.updated = updated.updated;

            // NEW: Add to result for provider to update local googleUpdated
            if (!result.updatedTaskLists) result.updatedTaskLists = [];
            result.updatedTaskLists.push({
              localId: localTaskList.id,
              title: localTaskList.title, // already correct locally
              googleId: cloudList.id,
              googleUpdated: updated.updated,
            });
          } catch (err) {
            console.error('Failed to update cloud task list title', err);
          }
        }
      }

      // Reconcile lists: 1) any local lists missing on cloud => create empty cloud lists
      const reconcileResult = await this.reconcileLocalToCloudLists(localTaskList, cloudLists, onProgress);
      const createdTaskLists = reconcileResult.createdTaskLists ?? [];
      const linkedTaskLists = reconcileResult.linkedTaskLists ?? [];
      const createdCloudLists = reconcileResult.createdCloudLists ?? []; if (createdTaskLists.length) {
        result.createdTaskLists = createdTaskLists;
        onProgress?.(`Created ${createdTaskLists.length} cloud task list(s) for local lists`);
      }
      // persist created local->cloud mapping
      if (createdTaskLists.length) {
        result.createdTaskLists = createdTaskLists;
        onProgress?.(`Created ${createdTaskLists.length} cloud task list(s) for local lists`);
      }
      // merge newly created cloud list objects into our in-memory snapshot BEFORE resolving current list
      if (createdCloudLists.length) {
        cloudLists.push(...createdCloudLists);
      }
      if (linkedTaskLists.length) {
        result.linkedTaskLists = linkedTaskLists;
      }

      // now resolve current list against updated cloudLists
      const googleTaskListId = await this.resolveOrCreateGoogleListFromLocal(localTaskList, cloudLists, onProgress);

      onProgress?.('Fetching existing remote tasks for current list...');
      const googleTasks = await this.tasksService.getTasks(googleTaskListId);
      const googleById = new Map(googleTasks.filter(t => t.id).map(t => [t.id!, t]));

      // Only operate on tasks that belong to the current localTaskList
      const currentLocalTasks = localTasks.filter(t => t.tasklistId === localTaskList.id);

      // Active tasks in current list (not soft-deleted)
      const activeLocalTasks = currentLocalTasks.filter(t => !t.isDeleted);

      // 1) Create remote tasks for local tasks without googleId (current list only)
      for (const local of activeLocalTasks) {
        if (!local.googleId) {
          onProgress?.(`Creating remote task: ${local.title}`);
          try {
            const createPayload = GoogleTasksService.localTaskToGoogleTaskCreate(local);
            delete (createPayload as any).id;
            delete (createPayload as any).updated;

            const created = await this.tasksService.createTask(googleTaskListId, createPayload as any);
            result.tasksAdded++;
            if (created && created.id) result.createdTasks!.push({ localId: local.id, googleId: created.id });
          } catch (err) {
            console.error(`Failed to create remote task for localId=${local.id}`, err);
          }
        }
      }

      // 2) Delete remote tasks for local tasks marked isDeleted (current list only)
      for (const local of currentLocalTasks) {
        if (local.isDeleted && local.googleId) {
          onProgress?.(`Deleting remote task: ${local.title}`);
          try {
            await this.tasksService.deleteTask(googleTaskListId, local.googleId);
            result.tasksDeleted++;
          } catch (err) {
            console.error(`Failed to delete remote task ${local.googleId}`, err);
          }
        }
      }

      // 3) Update remote tasks where local (current list) is newer
      for (const local of activeLocalTasks) {
        if (!local.googleId) continue;
        const g = googleById.get(local.googleId);
        if (!g) {
          // remote missing; policy: skip (download will mark deleted) or re-create
          continue;
        }
        const localModified = new Date(local.lastModified).getTime();
        const googleUpdated = g.updated ? new Date(g.updated).getTime() : 0;
        if (localModified > googleUpdated) {
          onProgress?.(`Updating remote task: ${local.title}`);
          try {
            const patch = GoogleTasksService.localTaskToGoogleTaskPatch(local);
            await this.tasksService.updateTask(googleTaskListId, local.googleId, patch as any);
            result.tasksUpdated++;
          } catch (err) {
            console.error(`Failed to update remote task ${local.googleId}`, err);
          }
        }
      }


      return result;
    } catch (err) {
      console.error('upload error', err);
      return {
        success: false,
        tasksAdded: 0,
        tasksUpdated: 0,
        tasksDeleted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------- Shared helpers ----------

  // Build list of cloud→local empty TaskList objects for cloud-only lists,
  // and build suggested linkings (title match). Does NOT persist anything.
  private reconcileCloudToLocalLists(localTaskList: TaskList, cloudLists: Array<{ id?: string; title?: string; updated?: string }>) {
    const addedTaskLists: TaskList[] = [];
    const linkedTaskLists: Array<{ localId: string; googleId: string }> = [];

    // Build local title map would be best provided by caller; simple approach here:
    const localTitles = new Map<string, TaskList>();
    // Here we only have the single localTaskList (current) passed — caller can do batch reconcile if needed.
    // If you need to reconcile across all local lists, call reconcileTaskLists (batch) separately.
    if (localTaskList) {
      const key = (localTaskList.title || '').trim().toLowerCase();
      if (key) localTitles.set(key, localTaskList);
    }

    for (const cloud of cloudLists) {
      if (!cloud.id) continue;
      // skip if user already has local list with the same cloud id (we only have one local input here)
      // That check is delegated to the provider (which has full local list state)
      const titleKey = (cloud.title || '').trim().toLowerCase();
      const localMatch = titleKey ? localTitles.get(titleKey) : undefined;
      if (localMatch) {
        // if local match exists but has no googleId, suggest linking
        if (!localMatch.googleId) linkedTaskLists.push({ localId: localMatch.id, googleId: cloud.id });
        continue;
      }
      // create minimal local TaskList placeholder
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

    return { addedTaskLists, linkedTaskLists };
  }

  // Reconcile local→cloud: for all local lists, create cloud lists where missing
  // Returns created mappings and link suggestions.
  private async reconcileLocalToCloudLists(
    localTaskList: TaskList,
    cloudLists: Array<{ id?: string; title?: string; updated?: string }>,
    onProgress?: (m: string) => void
  ): Promise<{
    createdTaskLists: Array<{ localId: string; googleId: string }>;
    linkedTaskLists: Array<{ localId: string; googleId: string }>;
    createdCloudLists: GoogleTaskList[]; // <-- strong typing
  }> {
    const createdTaskLists: Array<{ localId: string; googleId: string }> = [];
    const linkedTaskLists: Array<{ localId: string; googleId: string }> = [];
    const createdCloudLists: GoogleTaskList[] = [];

    if (!localTaskList) {
      return { createdTaskLists, linkedTaskLists, createdCloudLists };
    }

    // build cloud title map
    const cloudByTitle = new Map<string, { id?: string; title?: string }>();
    cloudLists.forEach(c => {
      const key = (c.title || '').trim().toLowerCase();
      if (key && !cloudByTitle.has(key)) cloudByTitle.set(key, c);
    });

    const titleKey = (localTaskList.title || '').trim().toLowerCase();
    const cloudMatch = titleKey ? cloudByTitle.get(titleKey) : undefined;
    if (cloudMatch && cloudMatch.id) {
      linkedTaskLists.push({ localId: localTaskList.id, googleId: cloudMatch.id });
      return { createdTaskLists, linkedTaskLists, createdCloudLists };
    }

    if (localTaskList.googleId) {
      const foundById = cloudLists.find(c => c.id === localTaskList.googleId);
      if (foundById && foundById.id) {
        linkedTaskLists.push({ localId: localTaskList.id, googleId: foundById.id });
        return { createdTaskLists, linkedTaskLists, createdCloudLists };
      }
    }

    // No match -> create cloud list
    try {
      onProgress?.(`Creating cloud task list for local '${localTaskList.title}'`);
      const created = await this.tasksService.createTaskList(localTaskList.title);
      if (created && created.id) {
        createdTaskLists.push({ localId: localTaskList.id, googleId: created.id });

        // Ensure we create a proper GoogleTaskList object (title required).
        // Use the returned title when present, otherwise fall back to the local title or 'Untitled'.
        const cloudObj: GoogleTaskList = {
          id: created.id,
          title: created.title ?? localTaskList.title ?? 'Untitled',
          updated: created.updated,
        };
        createdCloudLists.push(cloudObj);
      }
    } catch (err) {
      console.error('Failed to create cloud list for local list', localTaskList.title, err);
    }

    return { createdTaskLists, linkedTaskLists, createdCloudLists };
  }

  // call this during reconcile (server->local or pre-upload checks)
  private async handleListRenameOrDelete(
    localList: TaskList,
    cloudLists: GoogleTaskList[],
    onProgress?: (m: string) => void
  ): Promise<{
    action: 'link' | 'update-local-title' | 'mark-local-deleted' | 'recreate-cloud' | 'noop',
    cloudId?: string
  }> {
    const result = this.detectListRenameOrDelete(localList, cloudLists, localList.googleUpdated);

    // If we found the cloud list by id, check for title changes (rename)
    if (result.kind === 'ok' && result.cloud) {
      const cloud = result.cloud;
      const cloudUpdatedNum = cloud.updated ? new Date(cloud.updated).getTime() : 0;
      const localModifiedNum = localList.lastModified ? new Date(localList.lastModified).getTime() : 0;

      // If cloud's title differs and cloud is newer -> adopt cloud title
      if ((cloud.title ?? '').trim() !== (localList.title ?? '').trim() && cloudUpdatedNum > localModifiedNum) {
        onProgress?.(`List renamed in Google: adopting title '${cloud.title}'`);
        return { action: 'update-local-title', cloudId: cloud.id };
      }

      // Otherwise no action required
      return { action: 'noop', cloudId: cloud.id };
    }

    if (result.kind === 'cloud-renamed') {
      const cloudUpdatedNum = result.cloud.updated ? new Date(result.cloud.updated).getTime() : 0;
      const localModifiedNum = new Date(localList.lastModified).getTime();

      if (cloudUpdatedNum > localModifiedNum) {
        onProgress?.(`List renamed in Google: adopting title '${result.cloud.title}'`);
        return { action: 'update-local-title', cloudId: result.cloud.id };
      } else {
        onProgress?.(`List renamed locally more recently than Google; will recreate in cloud if needed`);
        return { action: 'recreate-cloud' };
      }
    }

    if (result.kind === 'cloud-deleted') {
      const localModifiedNum = new Date(localList.lastModified).getTime();
      const cloudUpdatedNum = result.lastCloudUpdate ?? 0;

      if (localModifiedNum > cloudUpdatedNum) {
        onProgress?.(`List was deleted on Google but has newer local changes — will recreate on Google`);
        return { action: 'recreate-cloud' };
      } else {
        onProgress?.(`List was deleted on Google; marking local as deleted`);
        return { action: 'mark-local-deleted' };
      }
    }

    return { action: 'noop' };
  }

  private detectListRenameOrDelete(
    localList: TaskList,
    cloudLists: GoogleTaskList[],
    lastKnownCloudUpdate?: string // e.g. localList.googleUpdated
  ): RenameOrDeleteResult {
    // 1) try find by id (normal)
    if (localList.googleId) {
      const foundById = cloudLists.find(c => c.id === localList.googleId);
      if (foundById) return { kind: 'ok', cloud: foundById };
    }

    // 2) try find by title (case-insensitive)
    const titleKey = (localList.title || '').trim().toLowerCase();
    if (titleKey) {
      const foundByTitle = cloudLists.find(c => (c.title || '').trim().toLowerCase() === titleKey);
      if (foundByTitle) {
        // cloud list exists but with different id -> rename or duplicate on cloud
        return { kind: 'cloud-renamed', cloud: foundByTitle };
      }
    }

    // 3) not found: cloud likely deleted this list
    const lastCloudUpdateNum = lastKnownCloudUpdate ? new Date(lastKnownCloudUpdate).getTime() : 0;
    return { kind: 'cloud-deleted', lastCloudUpdate: lastCloudUpdateNum || undefined };
  }



  // resolveOrCreateGoogleListFromCloud: prefer local's googleId, else try to find in cloud lists by title, else create
  private async resolveOrCreateGoogleListFromCloud(localTaskList: TaskList, cloudLists: Array<{ id?: string; title?: string }>, onProgress?: (m: string) => void): Promise<string> {
    // 1) if we already have googleId
    if (localTaskList.googleId) {
      const found = cloudLists.find(c => c.id === localTaskList.googleId);
      if (found && found.id) return found.id;
      // else continue to title search
    }

    const titleKey = (localTaskList.title || '').trim().toLowerCase();
    if (titleKey) {
      const match = cloudLists.find(c => (c.title || '').trim().toLowerCase() === titleKey);
      if (match && match.id) {
        return match.id;
      }
    }

    // not found -> create
    onProgress?.('Creating Google list for current local list...');
    const created = await this.tasksService.createTaskList(localTaskList.title);
    return created.id!;
  }

  // resolveOrCreateGoogleListFromLocal: similar but we may have cloudLists previously fetched
  private async resolveOrCreateGoogleListFromLocal(localTaskList: TaskList, cloudLists: Array<{ id?: string; title?: string }>, onProgress?: (m: string) => void): Promise<string> {
    // prefer existing googleId
    if (localTaskList.googleId) {
      const found = cloudLists.find(c => c.id === localTaskList.googleId);
      if (found && found.id) return found.id;
    }

    // try title match
    const titleKey = (localTaskList.title || '').trim().toLowerCase();
    if (titleKey) {
      const match = cloudLists.find(c => (c.title || '').trim().toLowerCase() === titleKey);
      if (match && match.id) return match.id;
    }

    // else create
    onProgress?.('Creating Google list for current local list...');
    const created = await this.tasksService.createTaskList(localTaskList.title);
    return created.id!;
  }
}
