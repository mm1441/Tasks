import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import type { Task } from "../types/Task";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { TaskList } from "../types/TaskList";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface TaskContextType {
  tasks: Task[];
  taskLists: TaskList[];
  currentTaskList: TaskList | null;
  currentTaskListId: string | null;
  addTask: (task: Omit<Task, "id" | "createdAt" | "lastModified">) => Promise<void>;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (newTasks: Task[]) => void;
  setCurrentTaskList: (id: string | null) => void;
  addTaskList: (taskList: Omit<TaskList, "id" | "createdAt" | "lastModified">) => void;
  updateTaskList: (taskList: TaskList) => void;
  deleteTaskList: (id: string) => void;
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

  useEffect(() => {
    loadData();
  }, []);

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

  // Persist taskLists whenever they change (but not during initial load)
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

  // Persist currentTaskListId whenever it changes (but not during initial load)
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
          // console.debug("[TaskProvider] loadData skipped restoring currentTaskListId because runtime value exists:", prev);
          return prev;
        }
        // console.debug("[TaskProvider] loadData restored currentTaskListId:", restoredCurrentListId);
        return restoredCurrentListId;
      });

      // console.debug("[TaskProvider] finished load: lists:", loadedTaskLists.map(l => l.title), "current:", restoredCurrentListId);

      // Reschedule notifications for loaded tasks
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
      console.debug("[TaskProvider] setCurrentTaskList called with:", id);

      // Normalize id -> nextId
      let nextId = id;

      // If attempting to set null but lists exist, keep current (ignore null)
      if (id === null && taskLists.length > 0) {
        console.warn("[TaskProvider] Ignoring setCurrentTaskList(null) because taskLists exist. Keeping previous:", currentTaskListId);
        return;
      }

      // If provided id doesn't exist, fall back to first list
      if (id !== null && !taskLists.some(tl => tl.id === id)) {
        nextId = taskLists.length > 0 ? taskLists[0].id : null;
        console.warn(`[TaskProvider] Provided id "${id}" not found; falling back to "${nextId}"`);
      }

      // Apply only if changed
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
      // find previous task snapshot
      const prevTask = tasks.find(t => t.id === updatedTask.id) ?? null;
      let currentNotificationId: string | null = prevTask?.notificationId ?? null;

      // If task is now completed -> cancel existing notification (if any) and clear id
      if (updatedTask.isCompleted) {
        if (currentNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(currentNotificationId).catch(() => { });
          currentNotificationId = null;
        }
      } else {
        // Task is not completed -> ensure a notification is scheduled if dueDate is in the future

        const prevDueTs = prevTask?.dueDate ? new Date(prevTask.dueDate).getTime() : null;
        const newDueTs = updatedTask.dueDate ? new Date(updatedTask.dueDate).getTime() : null;
        const dueChanged = prevDueTs !== newDueTs;

        const dueInFuture = updatedTask.dueDate && new Date(updatedTask.dueDate) > new Date();

        if (dueInFuture) {
          // If there is an existing notification and due did not change, keep it.
          if (currentNotificationId && !dueChanged) {
            // nothing to do
          } else {
            // cancel old one (if any) and create a new one
            if (currentNotificationId) {
              await Notifications.cancelScheduledNotificationAsync(currentNotificationId).catch(() => { });
              currentNotificationId = null;
            }
            const newNotifId = await scheduleNotification(updatedTask).catch(() => null);
            currentNotificationId = newNotifId ?? null;
          }
        } else {
          // no future due date -> cancel any existing notification
          if (currentNotificationId) {
            await Notifications.cancelScheduledNotificationAsync(currentNotificationId).catch(() => { });
            currentNotificationId = null;
          }
        }
      }

      // Persist the updated task including notificationId and lastModified
      const taskToStore: Task = {
        ...updatedTask,
        notificationId: currentNotificationId,
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
    setTasks(prev => prev.filter(t => t.id !== id));
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

  // Derived object for convenience
  const currentTaskList = useMemo(() => taskLists.find(tl => tl.id === currentTaskListId) ?? null, [taskLists, currentTaskListId]);

  if (isLoading) return null;

  return (
    <TaskContext.Provider value={{
      tasks,
      taskLists,
      currentTaskList,
      currentTaskListId,
      setCurrentTaskList,
      addTask,
      updateTask,
      deleteTask,
      reorderTasks,
      addTaskList,
      updateTaskList,
      deleteTaskList
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
