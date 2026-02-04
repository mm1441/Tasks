import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useTasks } from "../context/TaskContext";
import { useTheme } from "../context/ThemeContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { RootStackParamList } from "../App";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type EditTaskScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "EditTask">;
  route: RouteProp<RootStackParamList, "EditTask">;
};

export default function EditTaskScreen({ navigation, route }: EditTaskScreenProps) {
  console.log("[EditTaskScreen] ========== Screen Rendered ==========");
  console.log("[EditTaskScreen] Route params:", route.params);
  console.log("[EditTaskScreen] TaskId from route:", route.params.taskId);
  
  const { tasks, taskLists = [], updateTask, deleteTask } = useTasks();
  const { theme, scheme } = useTheme();
  const styles = makeStyles(theme, scheme);
  const taskId = route.params.taskId;
  
  console.log("[EditTaskScreen] TaskId variable:", taskId);
  console.log("[EditTaskScreen] Total tasks available:", tasks.length);
  
  const task = tasks.find((t) => t.id === taskId);
  
  console.log("[EditTaskScreen] Task found:", task ? "YES" : "NO");
  if (task) {
    console.log("[EditTaskScreen] Task title:", task.title);
  } else {
    console.warn("[EditTaskScreen] ⚠️ Task not found for taskId:", taskId);
    console.warn("[EditTaskScreen] Available task IDs:", tasks.map(t => t.id));
  }

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueDate, setDueDate] = useState<string | undefined>(task?.dueDate || undefined);
  const [showPicker, setShowPicker] = useState(false);

  // Track the selected task list (tasklistId in the Task type). Default to task's value.
  const [selectedTaskListId, setSelectedTaskListId] = useState<string | undefined>(
    task?.tasklistId || (taskLists.length > 0 ? taskLists[0].id : undefined)
  );

  // Track completed state locally and show checkmark.
  const [isCompleted, setIsCompleted] = useState<boolean>(!!task?.isCompleted);
  const [showTaskListMenu, setShowTaskListMenu] = useState(false);
  const [showDescriptionInput, setShowDescriptionInput] = useState<boolean>(!!task?.description);

  // Update state when taskId changes (when navigating to different task)
  // This is the primary effect that handles param changes
  useEffect(() => {
    const currentTask = tasks.find((t) => t.id === taskId);
    console.log("[EditTaskScreen] useEffect - taskId or tasks changed");
    console.log("[EditTaskScreen] Current taskId from route:", taskId);
    console.log("[EditTaskScreen] Found task:", currentTask ? currentTask.title : "NOT FOUND");
    
    if (currentTask) {
      console.log("[EditTaskScreen] Updating state with task:", currentTask.title);
      setTitle(currentTask.title);
      setDescription(currentTask.description || "");
      setDueDate(currentTask.dueDate || undefined);
      setIsCompleted(!!currentTask.isCompleted);
      setSelectedTaskListId(currentTask.tasklistId || (taskLists.length > 0 ? taskLists[0].id : undefined));
    } else {
      console.warn("[EditTaskScreen] Task not found, clearing state");
      setTitle("");
      setDescription("");
      setDueDate(undefined);
      setIsCompleted(false);
    }
  }, [taskId, tasks, taskLists]);

  // If taskLists load after mount and no selection is set, default to first list
  useEffect(() => {
    if ((!selectedTaskListId || selectedTaskListId === undefined) && taskLists.length > 0) {
      setSelectedTaskListId(taskLists[0].id);
    }
  }, [taskLists]);

  const handleSave = async () => {
    if (!title.trim() || !task) return;

    const updatedTask = {
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      isCompleted,
      tasklistId: selectedTaskListId || undefined,
    };

    await updateTask(updatedTask);
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        deleteTask(task.id);
        navigation.goBack();
      } },
    ]);
  };

  const handleConfirm = (selectedDate: Date) => {
    setShowPicker(false);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const hours = String(selectedDate.getHours()).padStart(2, "0");
    const minutes = String(selectedDate.getMinutes()).padStart(2, "0");
    setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const formatDueDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!task) {
    return (
      <View style={styles.container}>
        <Text style={{ color: theme.text }}>Task not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Task</Text>
        <TouchableOpacity onPress={handleSave} disabled={!title.trim()}>
          <Text style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter task title"
            placeholderTextColor={theme.muted}
          />        
        </View>

        {/* Compact actions row: description + due date */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowDescriptionInput((prev) => !prev)}
          >
            <Ionicons
              name={showDescriptionInput ? "document-text" : "document-text-outline"}
              size={20}
              color={showDescriptionInput ? theme.primary : theme.muted}
            />
          </TouchableOpacity>

          <View style={[styles.iconButton, dueDate && styles.iconButtonExpanded]}>
            <TouchableOpacity
              style={styles.iconButtonContent}
              onPress={() => setShowPicker(true)}
            >
              <Ionicons
                name={dueDate ? "calendar" : "calendar-outline"}
                size={20}
                color={dueDate ? theme.primary : theme.muted}
              />
              {dueDate ? (
                <Text
                  style={[styles.iconLabel, { color: theme.primary }]}
                  numberOfLines={1}
                >
                  {formatDueDate(dueDate)}
                </Text>
              ) : null}
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity
                onPress={() => setDueDate(undefined)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showDescriptionInput && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description (optional)"
              placeholderTextColor={theme.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        )}


        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={styles.completedRow}
            onPress={() => setIsCompleted((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCompleted }}
          >
            <Text style={styles.completedText}>Completed</Text>
            <Ionicons
              name={isCompleted ? "checkbox" : "square-outline"}
              size={22}
              color={isCompleted ? theme.primary : theme.muted}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Task List</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowTaskListMenu((prev) => !prev)}
          >
            <View style={styles.dropdownInner}>
              <Text style={styles.dropdownText}>
                {taskLists.find((l) => l.id === selectedTaskListId)?.title || "Select list"}
              </Text>
              <Ionicons
                name={showTaskListMenu ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.muted}
              />
            </View>
          </TouchableOpacity>

          {showTaskListMenu && (
            <View style={styles.dropdownMenu}>
              {taskLists.map((list) => {
                const selected = list.id === selectedTaskListId;
                return (
                  <TouchableOpacity
                    key={list.id}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedTaskListId(list.id);
                      setShowTaskListMenu(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{list.title}</Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.8 }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={theme.text} />
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </Pressable>
      </ScrollView>

      <DateTimePickerModal
        isVisible={showPicker}
        mode="datetime"
        onConfirm={handleConfirm}
        onCancel={() => setShowPicker(false)}
        date={dueDate ? new Date(dueDate) : new Date()}
      />

    </SafeAreaView>
  );
}

const makeStyles = (theme: any, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },

    cancelButton: {
      fontSize: 16,
      color: theme.primary,
    },
    saveButton: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: "600",
    },
    saveButtonDisabled: {
      color: theme.muted,
    },
    form: {
      flex: 1,
      padding: 20,
    },
    inputGroup: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.muted,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 16,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    },
    textArea: {
      height: 120,
      paddingTop: 16,
    },
    completedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.surface,

    },
    completedText: {
      color: theme.text,
      fontSize: 16,
    },
    checkmark: {
      fontSize: 18,
      color: theme.primary,
      fontWeight: "700",
    },
    dropdown: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 16,

      borderColor: theme.border,
    },
    dropdownInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dropdownText: {
      fontSize: 16,
      color: theme.text,
    },
    dropdownMenu: {
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    dropdownItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dropdownItemText: {
      fontSize: 16,
      color: theme.text,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    iconButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
      minWidth: 44,
    },
    iconButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
    },
    iconButtonExpanded: {
      flex: 1,
    },
    iconLabel: {
      fontSize: 14,
      color: theme.muted,
      flex: 1,
    },
    clearButton: {
      marginLeft: 4,
    },
    deleteButton: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 0,
      paddingVertical: 12,
      marginTop: 24,
      borderRadius: 8,
      backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: scheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    },
  });
