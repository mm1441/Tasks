import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useTasks } from "../context/TaskContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { RootStackParamList } from "../App";


type AddTaskProps = NativeStackScreenProps<RootStackParamList, "AddTask">;

export default function AddTaskScreen({ route, navigation }: AddTaskProps) {
  const { addTask } = useTasks();
  const { taskListId } = route.params ?? {};

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = () => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      tasklistId: taskListId || undefined
    });
    navigation.goBack();
  };

  const handleConfirm = (selectedDate: Date) => {
    setShowPicker(false);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  return (
    // Explain KeyboardAvoidingView and it's behaviour
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Task</Text>
        <TouchableOpacity onPress={handleSave} disabled={!title.trim()}>
          <Text style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter task title"
            placeholderTextColor="#999999"
            autoFocus
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description (optional)"
            placeholderTextColor="#999999"
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
                value={dueDate ? dueDate.replace("T", " ") : ""} // Display as YYYY-MM-DD HH:mm for readability
                placeholder="Tap to select date & time (optional)"
                placeholderTextColor="#999999"
                editable={true}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DateTimePickerModal
        isVisible={showPicker}
        mode="datetime"
        onConfirm={handleConfirm}
        onCancel={() => setShowPicker(false)}
        date={dueDate ? new Date(dueDate) : new Date()} // Default to now if no datetime set
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  cancelButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  saveButton: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  saveButtonDisabled: {
    color: "#cccccc",
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
    color: "#666666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    color: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
});