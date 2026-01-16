import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import type { Task } from "../types/Task";
import { TaskList } from "../types/TaskList";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { SyncService, SyncResult } from "../services/syncService";
import { WidgetStorage } from 'android-glance-widget-expo';
import { Platform } from 'react-native';

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
  reorderTasks: (newTasks: Task[]) => void;
  setCurrentTaskList: (id: string | null) => void;
  addTaskList: (taskList: Omit<TaskList, "id" | "createdAt" | "lastModified">) => void;
  updateTaskList: (taskList: TaskList) => void;
  deleteTaskList: (id: string) => void;
  syncWithGoogle: (accessToken: string, onProgress?: (message: string) => void) => Promise<SyncResult>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);
const TASKS_STORAGE_KEY = "@tasks";
const TASKLISTS_STORAGE_KEY = "@tasklists";
const CURRENT_TASKLIST_STORAGE_KEY = "@currentTaskList";

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [currentTaskListId, setCurrentTaskListId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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
    if (isLoading || Platform.OS !== 'android') return;

    (async () => {
      try {
        const filteredTasks = tasks.filter(t => t.tasklistId === currentTaskListId && !t.isDeleted && !t.isCompleted);
        // Serialize (limit to key fields to avoid bloat; add more if needed)
        const tasksData = filteredTasks.map(t => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          isCompleted: t.isCompleted,
        }));
        console.log("[Widget] Updating with tasks:", JSON.stringify(tasksData));
        await WidgetStorage.set('tasks', JSON.stringify(tasksData));
        await WidgetStorage.updateWidget('HomeReceiver');
        console.debug("[TaskProvider] Updated widget with tasks:", tasksData.length);
      } catch (e) {
        console.error("Failed to update widget:", e);
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
        loadedTaskLists = [
          { id: uuidv4(), title: "My List", createdAt: now, lastModified: now },
        ];
        await AsyncStorage.setItem(TASKLISTS_STORAGE_KEY, JSON.stringify(loadedTaskLists));
        console.debug("[TaskProvider] created default lists and persisted them");
      }
      // If restored current id doesn't match loaded lists, fall back to first
      const hasRestoredMatch = restoredCurrentListId && loadedTaskLists.some(tl => tl.id === restoredCurrentListId);
      if (!hasRestoredMatch) {
        restoredCurrentListId = loadedTaskLists.length > 0 ? loadedTaskLists[0].id : null;
      }

      setTasks(loadedTasks);
      setTaskLists(loadedTaskLists);

      // apply restored id only if currentTaskListId is still null (won't overwrite user selection)
      setCurrentTaskListId(prev => {
        if (prev !== null) {
          return prev;
        }
        return restoredCurrentListId;
      });

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
      try {
        await SplashScreen.hideAsync();
      } catch (e) { /* ignore if already hidden */ }
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
      setCurrentTaskListId(prev => {
        if (prev === nextId) return prev;
        console.debug("[TaskProvider] currentTaskListId changing:", prev, "=>", nextId);
        return nextId;
      });
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
          // no future due date -> cancel any existing notification
          if (existingNotificationId) {
            await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch(() => { });
            existingNotificationId = null;
          }
        }
      }
      const taskToStore: Task = {
        ...updatedTask,
        notificationId: existingNotificationId,
        lastModified: new Date().toISOString(),
      };
      setTasks(prev => prev.map(t => t.id === taskToStore.id ? taskToStore : t));
    } catch (err) {
      console.error("Failed to update task (notification handling):", err);
      // still try to update the task minimally
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...updatedTask, lastModified: new Date().toISOString() } : t));
    }
  };

  const addTask = async (taskData: Omit<Task, "id" | "createdAt" | "lastModified">) => {
    let assignedListId = taskData.tasklistId ?? currentTaskListId ?? (taskLists[0]?.id ?? null);

    if (!assignedListId) {
      // create a default list if none exist
      const now = new Date().toISOString();
      const defaultList: TaskList = { id: uuidv4(), title: "My List 1", createdAt: now, lastModified: now };
      setTaskLists(prev => [...prev, defaultList]);
      assignedListId = defaultList.id;
      setCurrentTaskList(defaultList.id);
    }

    const newTask: Task = {
      ...taskData,
      tasklistId: assignedListId,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      isCompleted: false,
      notificationId: null,
    };

    setTasks(prev => [...prev, newTask]);

    if (!newTask.isCompleted && newTask.dueDate && new Date(newTask.dueDate) > new Date()) {
      const notifId = await scheduleNotification(newTask).catch(() => null);
      if (notifId) {
        setTasks(prev => prev.map(t => t.id === newTask.id ? { ...t, notificationId: notifId } : t));
      }
    }
  };

  const reorderTasks = (newTasks: Task[]) => setTasks(newTasks);

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.googleId) {
      // Mark as deleted instead of removing (for sync)
      setTasks(prev => prev.map(t =>
        t.id === id ? { ...t, isDeleted: true, lastModified: new Date().toISOString() } : t
      ));
    } else {
      // No Google ID, safe to delete immediately
      setTasks(prev => prev.filter(t => t.id !== id));
    }
    Notifications.cancelScheduledNotificationAsync(id).catch(() => { });
  };

  const addTaskList = (taskListData: Omit<TaskList, "id" | "createdAt" | "lastModified">) => {
    const newTaskList: TaskList = {
      ...taskListData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    setTaskLists(prev => {
      const next = [...prev, newTaskList];
      // If there's no current selection, become current
      if (!currentTaskListId) {
        setCurrentTaskList(newTaskList.id);
      }

      return next;
    });
  };

  const updateTaskList = (updatedTaskList: TaskList) => {
    setTaskLists(prev => prev.map(tl => tl.id === updatedTaskList.id ? { ...updatedTaskList, lastModified: new Date().toISOString() } : tl));
  };

  const deleteTaskList = (id: string) => {
    // cancel notifications for tasks in that list
    const tasksToCancel = tasks.filter(t => t.tasklistId === id);
    tasksToCancel.forEach(t =>
      Notifications.cancelScheduledNotificationAsync(t.id).catch(() => { })
    );

    // remove tasks in that list
    setTasks(prev => prev.filter(t => t.tasklistId !== id));

    // remove list and pick a fallback current list if necessary
    setTaskLists(prev => {
      const remaining = prev.filter(tl => tl.id !== id);
      if (currentTaskListId === id) {
        setCurrentTaskList(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  // schedule notification, returns identifier
  const scheduleNotification = async (task: Task): Promise<string | null> => {
    if (!task.dueDate) return null;
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: { title: "Task Due: " + task.title, body: task.description || "Your task is due now!" },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(task.dueDate) },
      });
      return identifier;
    } catch (err) {
      console.error("Failed to schedule notification:", err);
      return null;
    }
  };

  const syncWithGoogle = async (
    accessToken: string,
    onProgress?: (message: string) => void
  ): Promise<SyncResult> => {
    if (!currentTaskList) {
      throw new Error('No task list selected');
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const syncService = new SyncService(accessToken);
      const result = await syncService.syncTaskList(
        currentTaskList,
        tasks,
        onProgress
      );

      if (result.success) {
        // console.debug(result)
        // Apply sync results to local state
        setTasks(prev => {
          let updated = [...prev];

          // Update tasks that were modified from cloud
          if (result.updatedTasks) {
            result.updatedTasks.forEach(cloudTask => {
              const index = updated.findIndex(localTask => localTask.googleId === cloudTask.googleId);
              if (index >= 0) {
                updated[index] = cloudTask;
              }
            });
          }

          // Add tasks from cloud
          if (result.addedTasks) {
            result.addedTasks.forEach(newTask => {
              if (!updated.some(t => t.googleId === newTask.googleId)) {
                updated.push(newTask);
              }
            });
          }

          // Update Google IDs for tasks that were created locally
          if (result.createdTasks) {
            result.createdTasks.forEach(({ localId, googleId }) => {
              const index = updated.findIndex(t => t.id === localId);
              if (index >= 0) {
                updated[index] = { ...updated[index], googleId };
              }
            });
          }

          // Mark tasks as deleted that were deleted on cloud
          if (result.deletedTasks) {
            result.deletedTasks.forEach(taskId => {
              const index = updated.findIndex(t => t.id === taskId);
              if (index >= 0) {
                updated[index] = { ...updated[index], isDeleted: true };
              }
            });
          }

          return updated;
        });

        // Update task list with Google ID if needed
        if (result.taskListGoogleId && currentTaskList.googleId !== result.taskListGoogleId) {
          setTaskLists(prev => prev.map(tl =>
            tl.id === currentTaskList.id
              ? { ...tl, googleId: result.taskListGoogleId!, googleUpdated: new Date().toISOString() }
              : tl
          ));
        }

        setSyncStatus('success');
        // Reset to idle after 2 seconds
        setTimeout(() => setSyncStatus('idle'), 2000);
      } else {
        setSyncStatus('error');
        setSyncError(result.error || 'Sync failed');
        // Reset to idle after 5 seconds
        setTimeout(() => {
          setSyncStatus('idle');
          setSyncError(null);
        }, 5000);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncStatus('error');
      setSyncError(errorMessage);
      // Reset to idle after 5 seconds
      setTimeout(() => {
        setSyncStatus('idle');
        setSyncError(null);
      }, 5000);
      throw error;
    }
  };

  // Derived object for convenience
  const currentTaskList = useMemo(() => taskLists.find(tl => tl.id === currentTaskListId) ?? null, [taskLists, currentTaskListId]);

  if (isLoading) return null;

  return (
    <TaskContext.Provider value={{
      tasks,
      taskLists,
      currentTaskList,
      currentTaskListId,
      syncStatus,
      syncError,
      setCurrentTaskList,
      addTask,
      updateTask,
      deleteTask,
      reorderTasks,
      addTaskList,
      updateTaskList,
      deleteTaskList,
      syncWithGoogle,
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
