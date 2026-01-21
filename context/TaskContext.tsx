import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import * as SplashScreen from "expo-splash-screen";
import type { Task } from "../types/Task";
import { TaskList } from "../types/TaskList";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { SyncService, SyncResult } from "../services/SyncService";
import { Platform, NativeModules } from 'react-native';
const { WidgetStorage } = NativeModules;

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface TaskContextType {
  tasks: Task[];
  taskLists: TaskList[];
  currentTaskList: TaskList | null;
  currentTaskListId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  addTask: (task: Omit<Task, "id" | "createdAt" | "lastModified">) => Promise<void>;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  permanentlyDeleteTask: (id: string) => void;
  reorderTasks: (newTasks: Task[]) => void;
  setCurrentTaskList: (id: string | null) => void;
  addTaskList: (taskList: Omit<TaskList, "id" | "createdAt" | "lastModified">) => void;
  updateTaskList: (taskList: TaskList) => void;
  deleteTaskList: (id: string) => void;
  downloadFromGoogle: (accessToken: string, onProgress?: (message: string) => void) => Promise<SyncResult>;
  uploadToGoogle: (accessToken: string, onProgress?: (message: string) => void) => Promise<SyncResult>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);
const TASKS_STORAGE_KEY = "@tasks";
const TASKLISTS_STORAGE_KEY = "@tasklists";
const CURRENT_TASKLIST_STORAGE_KEY = "@currentTaskList";
const APP_GROUP_IDENTIFIER = 'group.com.magicmarinac.tasks';  // Match your app.json entitlements

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [currentTaskListId, setCurrentTaskListId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const currentTaskList = useMemo(() => taskLists.find(tl => tl.id === currentTaskListId) ?? null, [taskLists, currentTaskListId]);


  useEffect(() => { loadData(); }, []);

  // Persist tasks whenever they change
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      try {
        await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
        console.debug("[TaskProvider] saved tasks count:", tasks.length);
      } catch (e) {
        console.error("Failed to save tasks:", e);
      }
    })();
  }, [tasks, isLoading]);

  // Persist taskLists whenever they change
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      try {
        await AsyncStorage.setItem(TASKLISTS_STORAGE_KEY, JSON.stringify(taskLists));
        console.debug("[TaskProvider] saved taskLists ->", taskLists.map(t => t.title));
      } catch (e) {
        console.error("Failed to save task lists:", e);
      }
    })();
  }, [taskLists, isLoading]);

  // Persist currentTaskListId whenever it changes
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      try {
        if (currentTaskListId === null) {
          await AsyncStorage.removeItem(CURRENT_TASKLIST_STORAGE_KEY);
        } else {
          await AsyncStorage.setItem(CURRENT_TASKLIST_STORAGE_KEY, currentTaskListId);
        }
        console.debug("[TaskProvider] saved currentTaskListId ->", currentTaskListId);
      } catch (e) {
        console.error("Failed to save current task list id:", e);
      }
    })();
  }, [currentTaskListId, isLoading]);

  // Update widget whenever tasks or current list change
  useEffect(() => {
    if (isLoading) return;
    if (!WidgetStorage) {
      console.warn("[Widget] WidgetStorage not ready yet");
      return;
    }

    (async () => {
      try {
        const filteredTasks = tasks.filter(t => t.tasklistId === currentTaskListId && !t.isDeleted && !t.isCompleted);
        const tasksData = filteredTasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, isCompleted: t.isCompleted }));
        console.log("[Widget] Updating with tasks:", JSON.stringify(tasksData));
        console.log("NativeModules.WidgetStorage =", NativeModules.WidgetStorage);

        // Store in shared preferences (cross-platform)
        await SharedGroupPreferences.setItem('tasks', tasksData, APP_GROUP_IDENTIFIER, {
          useAndroidSharedPreferences: Platform.OS === 'android'  // Use internal SharedPreferences on Android (no permissions needed)
        });

        if (Platform.OS === "android") {
          const json = JSON.stringify(tasksData);
          WidgetStorage.setTasks(json);
          WidgetStorage.updateWidget();
        }

        console.debug("[TaskProvider] Updated widget data with tasks:", tasksData.length);
      } catch (e) {
        console.error("Failed to update widget data:", e);
      }
    })();
  }, [tasks, currentTaskListId, isLoading]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const storedTasks = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
      const storedTaskLists = await AsyncStorage.getItem(TASKLISTS_STORAGE_KEY);
      const storedCurrentTaskListId = await AsyncStorage.getItem(CURRENT_TASKLIST_STORAGE_KEY);

      let loadedTasks: Task[] = storedTasks ? JSON.parse(storedTasks) : [];
      let loadedTaskLists: TaskList[] = storedTaskLists ? JSON.parse(storedTaskLists) : [];
      let restoredCurrentListId: string | null = storedCurrentTaskListId ?? null;

      if (!loadedTaskLists || loadedTaskLists.length === 0) {
        const now = new Date().toISOString();
        loadedTaskLists = [{ id: uuidv4(), title: "My List", createdAt: now, lastModified: now }];
        await AsyncStorage.setItem(TASKLISTS_STORAGE_KEY, JSON.stringify(loadedTaskLists));
        console.debug("[TaskProvider] created default lists and persisted them");
      }

      const hasRestoredMatch = restoredCurrentListId && loadedTaskLists.some(tl => tl.id === restoredCurrentListId);
      if (!hasRestoredMatch) {
        restoredCurrentListId = loadedTaskLists.length > 0 ? loadedTaskLists[0].id : null;
      }

      setTasks(loadedTasks);
      setTaskLists(loadedTaskLists);
      setCurrentTaskListId(prev => prev !== null ? prev : restoredCurrentListId);

      await Notifications.cancelAllScheduledNotificationsAsync();
      loadedTasks.forEach(task => {
        if (task.dueDate && new Date(task.dueDate) > new Date()) {
          scheduleNotification(task).catch(e => console.warn("schedule err", e));
        }
      });
    } catch (err) {
      console.error("Failed to load TaskProvider data:", err);
    } finally {
      setIsLoading(false);
      try { await SplashScreen.hideAsync(); } catch (e) { /* ignore */ }
    }
  };

  const setCurrentTaskList = (id: string | null) => {
    try {
      let nextId = id;
      if (id === null && taskLists.length > 0) {
        console.warn("[TaskProvider] Ignoring setCurrentTaskList(null) because taskLists exist. Keeping previous:", currentTaskListId);
        return;
      }
      if (id !== null && !taskLists.some(tl => tl.id === id)) {
        nextId = taskLists.length > 0 ? taskLists[0].id : null;
        console.warn(`[TaskProvider] Provided id "${id}" not found; falling back to "${nextId}"`);
      }
      setCurrentTaskListId(prev => prev === nextId ? prev : nextId);
    } catch (err) {
      console.error("[TaskProvider] setCurrentTaskList ERROR", err);
    }
  };

  const updateTask = async (updatedTask: Task) => {
    try {
      const prevTask = tasks.find(t => t.id === updatedTask.id) ?? null;
      let existingNotificationId: string | null = prevTask?.notificationId ?? null;

      if (updatedTask.isCompleted) {
        if (existingNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(() => { });
          existingNotificationId = null;
        }
      } else {
        const prevDue = prevTask?.dueDate ? new Date(prevTask.dueDate).getTime() : null;
        const newDue = updatedTask.dueDate ? new Date(updatedTask.dueDate).getTime() : null;
        const dueChanged = prevDue !== newDue;
        const dueInFuture = updatedTask.dueDate && (new Date(updatedTask.dueDate) > new Date());

        if (dueInFuture) {
          if (!existingNotificationId || dueChanged) {
            if (existingNotificationId) {
              await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(() => { });
              existingNotificationId = null;
            }
            const newNotifId = await scheduleNotification(updatedTask).catch(() => null);
            existingNotificationId = newNotifId ?? null;
          }
        } else {
          if (existingNotificationId) {
            await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(() => { });
            existingNotificationId = null;
          }
        }
      }
      const taskToStore: Task = { ...updatedTask, notificationId: existingNotificationId, lastModified: new Date().toISOString() };
      setTasks(prev => prev.map(t => t.id === taskToStore.id ? taskToStore : t));
    } catch (err) {
      console.error("Failed to update task (notification handling):", err);
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...updatedTask, lastModified: new Date().toISOString() } : t));
    }
  };

  const addTask = async (taskData: Omit<Task, "id" | "createdAt" | "lastModified">) => {
    let assignedListId = taskData.tasklistId ?? currentTaskListId ?? (taskLists[0]?.id ?? null);

    if (!assignedListId) {
      const now = new Date().toISOString();
      const defaultList: TaskList = { id: uuidv4(), title: "My List 1", createdAt: now, lastModified: now };
      setTaskLists(prev => [...prev, defaultList]);
      assignedListId = defaultList.id;
      setCurrentTaskList(defaultList.id);
    }

    const newTask: Task = { ...taskData, tasklistId: assignedListId, id: Date.now().toString(), createdAt: new Date().toISOString(), lastModified: new Date().toISOString(), isCompleted: false, notificationId: null };

    setTasks(prev => [...prev, newTask]);

    if (!newTask.isCompleted && newTask.dueDate && new Date(newTask.dueDate) > new Date()) {
      const notifId = await scheduleNotification(newTask).catch(() => null);
      if (notifId) setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, notificationId: notifId } : t));
    }
  };

  const reorderTasks = (newTasks: Task[]) => setTasks(newTasks);

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.googleId) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isDeleted: true, lastModified: new Date().toISOString() } : t));
    } else {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
  };

  const permanentlyDeleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Cancel any scheduled notification
    if (task.notificationId) {
      Notifications.cancelScheduledNotificationAsync(task.notificationId).catch(() => { });
    }

    // Remove the task completely from the local state
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const addTaskList = (taskListData: Omit<TaskList, "id" | "createdAt" | "lastModified">) => {
    const newTaskList: TaskList = { ...taskListData, id: uuidv4(), createdAt: new Date().toISOString(), lastModified: new Date().toISOString() };
    setTaskLists(prev => { const next = [...prev, newTaskList]; if (!currentTaskListId) setCurrentTaskList(newTaskList.id); return next; });
  };

  const updateTaskList = (updatedTaskList: TaskList) => setTaskLists(prev => prev.map(tl => tl.id === updatedTaskList.id ? { ...updatedTaskList, lastModified: new Date().toISOString() } : tl));

  const deleteTaskList = (id: string) => {
    const tasksToCancel = tasks.filter(t => t.tasklistId === id);
    tasksToCancel.forEach(t => Notifications.cancelScheduledNotificationAsync(t.id).catch(() => { }));
    setTasks(prev => prev.filter(t => t.tasklistId !== id));
    setTaskLists(prev => {
      const remaining = prev.filter(tl => tl.id !== id);
      if (currentTaskListId === id)
        setCurrentTaskList(remaining.length > 0 ? remaining[0].id : null);
      return remaining;
    });
  };

  const scheduleNotification = async (task: Task): Promise<string | null> => {
    if (!task.dueDate) return null;
    try {
      const identifier = await Notifications.scheduleNotificationAsync({ content: { title: "Task Due: " + task.title, body: task.description || "Your task is due now!" }, trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(task.dueDate) } });
      return identifier;
    } catch (err) {
      console.error("Failed to schedule notification:", err);
      return null;
    }
  };

  const downloadFromGoogle = async (
    accessToken: string,
    onProgress?: (message: string) => void
  ): Promise<SyncResult> => {

    if (!currentTaskList) throw new Error('No task list selected');
    setSyncStatus('syncing');
    setSyncError(null);
    const service = new SyncService(accessToken);

    // Call download (will also return lists that are cloud-only)
    const result = await service.download(currentTaskList, tasks, taskLists, onProgress);

    // 1) Apply task-list level changes first
    setTaskLists(prev => {
      let next = [...prev];

      // a) Add any cloud-only lists that were returned (addedTaskLists)
      if (result.addedTaskLists && result.addedTaskLists.length > 0) {
        for (const cloudList of result.addedTaskLists) {
          // avoid duplicates by googleId or title
          const existsByGoogleId = cloudList.googleId && next.some(tl => tl.googleId === cloudList.googleId);
          const existsByTitle = cloudList.title && next.some(tl => tl.title?.trim().toLowerCase() === cloudList.title!.trim().toLowerCase());
          if (!existsByGoogleId && !existsByTitle) {
            next.push(cloudList);
          }
        }
      }

      // b) Persist any linked lists suggested by title matching
      if ((result.linkedTaskLists && result.linkedTaskLists.length > 0)) {
        for (const link of result.linkedTaskLists) {
          const index = next.findIndex(tl => tl.id === link.localId);
          if (index >= 0) {
            next[index] = { ...next[index], googleId: link.googleId, googleUpdated: new Date().toISOString() };
          }
        }
      }

      // c) If the download created/returned a googleId for the current list, ensure it's persisted
      if (result.taskListGoogleId) {
        const idx = next.findIndex(tl => tl.id === currentTaskList.id);
        if (idx >= 0 && next[idx].googleId !== result.taskListGoogleId) {
          next[idx] = { ...next[idx], googleId: result.taskListGoogleId, googleUpdated: new Date().toISOString() };
        }
      }

      return next;
    });

    // after receiving result from service.download(...)
    if (result.updatedTaskLists) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const upd of result.updatedTaskLists!) {
          const idx = next.findIndex(tl => tl.id === upd.localId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              title: upd.title,
              googleId: upd.googleId || next[idx].googleId,
              googleUpdated: upd.googleUpdated ?? new Date().toISOString(),
              lastModified: new Date().toISOString(),
            };
          }
        }
        return next;
      });
    }


    // 2) Apply task-level changes (only for current list)
    setTasks(prev => {
      let next = [...prev];

      // a) Replace/patch updated tasks coming from cloud (preserve local id mapping already set by service)
      if (result.updatedTasks) {
        for (const cloudTask of result.updatedTasks) {
          const i = next.findIndex(t => t.id === cloudTask.id);
          if (i >= 0) {
            next[i] = cloudTask;
          }
        }
      }

      // b) Add new tasks from cloud (avoid duplicates by googleId)
      if (result.addedTasks) {
        for (const newTask of result.addedTasks) {
          const exists = newTask.googleId && next.some(t => t.googleId === newTask.googleId);
          if (!exists) {
            next.push(newTask);
          }
        }
      }

      // c) Mark local tasks as deleted when cloud indicates deletion
      if (result.deletedTasks) {
        for (const localId of result.deletedTasks) {
          const idx = next.findIndex(t => t.id === localId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], isDeleted: true, lastModified: new Date().toISOString() };
          }
        }
      }

      return next;
    });

    // 3) If the service returned any createdTaskLists (unlikely for download, but safe to handle),
    //    persist googleId mapping for the matching local lists
    if (result.createdTaskLists && result.createdTaskLists.length > 0) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const mapping of result.createdTaskLists!) {
          const idx = next.findIndex(tl => tl.id === mapping.localId);
          if (idx >= 0 && next[idx].googleId !== mapping.googleId) {
            next[idx] = { ...next[idx], googleId: mapping.googleId, googleUpdated: new Date().toISOString() };
          }
        }
        return next;
      });
    }

    // 4) Update currentTaskList googleId if provided (already handled above, but ensure currentTaskList referenced in state)
    if (result.taskListGoogleId && currentTaskList.googleId !== result.taskListGoogleId) {
      setTaskLists(prev => prev.map(tl =>
        tl.id === currentTaskList.id ? { ...tl, googleId: result.taskListGoogleId, googleUpdated: new Date().toISOString() } : tl
      ));
    }

    // Finalize UI status
    if (result.success) {
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 1500);
    } else {
      setSyncStatus('error');
      setSyncError(result.error || 'Download failed');
      setTimeout(() => { setSyncStatus('idle'); setSyncError(null); }, 5000);
    }

    return result;
  };


  const uploadToGoogle = async (
    accessToken: string,
    onProgress?: (message: string) => void
  ): Promise<SyncResult> => {

    if (!currentTaskList)
      throw new Error('No task list selected');
    setSyncStatus('syncing');
    setSyncError(null);
    const service = new SyncService(accessToken);

    // Call upload (will also create cloud lists for local-only lists)
    const result = await service.upload(currentTaskList, tasks, onProgress);

    // 1) Persist any cloud lists created for local lists
    if (result.createdTaskLists && result.createdTaskLists.length > 0) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const mapping of result.createdTaskLists!) {
          const idx = next.findIndex(tl => tl.id === mapping.localId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], googleId: mapping.googleId, googleUpdated: new Date().toISOString() };
          }
        }
        return next;
      });
    }

    // 2) Persist any linked lists suggested by title matching
    if (result.linkedTaskLists && result.linkedTaskLists.length > 0) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const mapping of result.linkedTaskLists!) {
          const idx = next.findIndex(tl => tl.id === mapping.localId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], googleId: mapping.googleId, googleUpdated: new Date().toISOString() };
          }
        }
        return next;
      });
    }

    // 3) If any cloud lists were discovered and returned as addedTaskLists (cloud->local),
    //    merge them into local lists (avoid duplicates)
    if (result.addedTaskLists && result.addedTaskLists.length > 0) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const cloudList of result.addedTaskLists!) {
          const existsByGoogleId = cloudList.googleId && next.some(tl => tl.googleId === cloudList.googleId);
          const existsByTitle = cloudList.title && next.some(tl => tl.title?.trim().toLowerCase() === cloudList.title!.trim().toLowerCase());
          if (!existsByGoogleId && !existsByTitle) next.push(cloudList);
        }
        return next;
      });
    }

    if (result.updatedTaskLists && result.updatedTaskLists.length > 0) {
      setTaskLists(prev => {
        let next = [...prev];
        for (const upd of result.updatedTaskLists!) {
          const idx = next.findIndex(tl => tl.id === upd.localId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              title: upd.title,
              googleId: upd.googleId || next[idx].googleId,
              googleUpdated: upd.googleUpdated ?? new Date().toISOString(),
              lastModified: new Date().toISOString(),
            };
          }
        }
        return next;
      });
    }

    // 4) Apply task-level results: createdTasks -> set googleId on local tasks
    setTasks(prev => {
      let next = [...prev];
      if (result.createdTasks) {
        for (const { localId, googleId } of result.createdTasks) {
          const idx = next.findIndex(t => t.id === localId);
          if (idx >= 0) next[idx] = { ...next[idx], googleId };
        }
      }

      // If upload returned addedTasks/updatedTasks (shouldn't be common), merge safely
      if (result.updatedTasks) {
        for (const t of result.updatedTasks) {
          const i = next.findIndex(x => x.id === t.id);
          if (i >= 0) next[i] = t;
        }
      }
      if (result.addedTasks) {
        for (const t of result.addedTasks) {
          if (!next.some(x => x.googleId === t.googleId)) next.push(t);
        }
      }
      // If upload returned deletedTasks (local ids to mark deleted), apply them
      if (result.deletedTasks) {
        for (const id of result.deletedTasks) {
          const idx = next.findIndex(t => t.id === id);
          if (idx >= 0) next[idx] = { ...next[idx], isDeleted: true };
        }
      }

      return next;
    });

    // 5) Persist googleId for the current task list if provided
    if (result.taskListGoogleId && currentTaskList.googleId !== result.taskListGoogleId) {
      setTaskLists(prev => prev.map(tl =>
        tl.id === currentTaskList.id ? { ...tl, googleId: result.taskListGoogleId, googleUpdated: new Date().toISOString() } : tl
      ));
    }

    // Finalize UI status
    if (result.success) {
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 1500);
    } else {
      setSyncStatus('error');
      setSyncError(result.error || 'Upload failed');
      setTimeout(() => { setSyncStatus('idle'); setSyncError(null); }, 5000);
    }

    return result;
  };


  if (isLoading)
    return null as any;
  return (
    <TaskContext.Provider value={{
      tasks, taskLists, currentTaskList, currentTaskListId,
      syncStatus, syncError, setCurrentTaskList, addTask, updateTask, deleteTask,
      permanentlyDeleteTask, reorderTasks, addTaskList, updateTaskList, deleteTaskList,
      downloadFromGoogle, uploadToGoogle
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTasks must be used within TaskProvider");
  return ctx;
}
