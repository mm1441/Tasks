import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useTasks } from "../context/TaskContext";
import { useTheme } from "../context/ThemeContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { RootStackParamList } from "../App";
import { SafeAreaView } from "react-native-safe-area-context";

type EditTaskScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "EditTask">;
  route: RouteProp<RootStackParamList, "EditTask">;
};

export default function EditTaskScreen({ navigation, route }: EditTaskScreenProps) {
  const { tasks, taskLists = [], updateTask } = useTasks();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const taskId = route.params.taskId;
  const task = tasks.find((t) => t.id === taskId);

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

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setDueDate(task.dueDate || undefined);
      setIsCompleted(!!task.isCompleted);
      setSelectedTaskListId(task.tasklistId || (taskLists.length > 0 ? taskLists[0].id : undefined));
    }
  }, [task, taskLists]);

  // If taskLists load after mount and no selection is set, default to first list
  useEffect(() => {
    if ((!selectedTaskListId || selectedTaskListId === undefined) && taskLists.length > 0) {
      setSelectedTaskListId(taskLists[0].id);
    }
  }, [taskLists]);

  const handleSave = () => {
    if (!title.trim() || !task) return;

    const updatedTask = {
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
      isCompleted,
      tasklistId: selectedTaskListId || undefined,
    };

    updateTask(updatedTask);
    navigation.goBack();
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
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Enter task title" placeholderTextColor={theme.muted} autoFocus />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Description
          </Text>
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Due Date & Time</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <View pointerEvents="none">
              <TextInput
                style={styles.input}
                value={dueDate ? dueDate.replace("T", " ") : ""}
                placeholder="Tap to select date & time (optional)"
                placeholderTextColor={theme.muted}
                editable={false}
              />
            </View>
          </TouchableOpacity>
        </View>


        <View style={styles.inputGroup}>
          <Text style={styles.label}>Task List</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowTaskListMenu((prev) => !prev)}
          >
            <Text style={styles.dropdownText}>
              {taskLists.find((l) => l.id === selectedTaskListId)?.title || "Select list"}
            </Text>
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Completed</Text>
          <TouchableOpacity
            style={styles.completedRow}
            onPress={() => setIsCompleted((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCompleted }}
          >
            <Text style={styles.completedText}>{isCompleted ? "Completed" : "Mark as completed"}</Text>
            <Text style={styles.checkmark}>{isCompleted ? "✓" : ""}</Text>
          </TouchableOpacity>
        </View>
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

const makeStyles = (theme: any) =>
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
      backgroundColor: theme.surface,
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
      borderWidth: 1,
      borderColor: theme.border,
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
      borderWidth: 1,
      borderColor: theme.border,
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
  });
