import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Task } from "../types/task";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "lastModified">) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const STORAGE_KEY = "@tasks"; // This is a unique string key used by AsyncStorage to identify where to store/retrieve the tasks array as JSON. Prefixing with '@' is a common convention for app-specific keys to avoid conflicts.

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      saveTasks();
    }
  }, [tasks]); // The dependency array [tasks] tells React to run this effect whenever the 'tasks' state changes. This auto-saves tasks on any add/update/delete, but skips if empty (e.g., on initial load).

  const loadTasks = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        // ToDo: If synced with Google Tasks fetch from API
        // else: 
        const loadedTasks: Task[] = JSON.parse(stored);
        // What if user saved task offline? It should be added to server. Smartest way to implement?
        // Add an 'isSynced: boolean' field to Task interface (default false for new/updated tasks).
        // On load (or when online), filter unsynced tasks, push to Google Tasks API, update local with server IDs if needed, then set isSynced=true and save.
        // Use Expo's NetInfo to detect online status for sync triggers. For conflicts, use lastModified timestamps to resolve (server wins or merge).
        // This enables offline-first: Local changes work offline, sync when connected.
        setTasks(loadedTasks);
        // Reschedule notifications for all future tasks on load
        await Notifications.cancelAllScheduledNotificationsAsync();
        loadedTasks.forEach((task) => {
          if (task.dueDate && new Date(task.dueDate) > new Date()) {
            scheduleNotification(task);
          }
        });
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    }
  };

  const saveTasks = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks:", error);
    }
  };

  const updateTask = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => t.id === updatedTask.id ? updatedTask : t));
    Notifications.cancelScheduledNotificationAsync(updatedTask.id);
    if (updatedTask.dueDate && new Date(updatedTask.dueDate) > new Date()) {
      scheduleNotification(updatedTask);
    }
  };

  const addTask = (taskData: Omit<Task, "id" | "createdAt" | "lastModified">) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(), // ???????
      createdAt: new Date().toISOString(), // Double check if this is default time or local
      // This produces UTC time (e.g., "2025-12-28T12:00:00.000Z"). For consistency with local dueDate formatting, you could use the same manual local string (e.g., `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`), but since createdAt/lastModified aren't user-facing/displayed, UTC is fine and simpler for future server sync (Google Tasks uses UTC timestamps).
      lastModified: new Date().toISOString()
    };
    setTasks((prev) => [...prev, newTask]);
    if (newTask.dueDate && new Date(newTask.dueDate) > new Date()) {
      scheduleNotification(newTask);
    }
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    Notifications.cancelScheduledNotificationAsync(id); // Cancel using task ID as identifier
  };

  const scheduleNotification = async (task: Task) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Due: " + task.title,
        body: task.description || "Your task is due now!",
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(task.dueDate!), // Schedule at exact due datetime and maybe before
        // To add a reminder (e.g., 15 min before), duplicate this call with date: new Date(new Date(task.dueDate!).getTime() - 15*60000), custom title/body, and unique identifier (e.g., task.id + "-reminder").
      },
      identifier: task.id, // Unique ID for cancellation
    });
  };

  return <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask }}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
}