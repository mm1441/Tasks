import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Checkbox from "expo-checkbox";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "../context/TaskContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Task } from "../types/Task";
import React from "react";

type RootStackParamList = {
  Home: undefined;
  AddTask: undefined;
  EditTask: { taskId: string };
};

type TaskCardProps = {
  item: Task;
  onLongPress: (id: string, title: string) => void;
  showDragHandle?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isActive?: boolean;
};

function TaskCardInner({ item, onLongPress: onDelete, showDragHandle = false, onDragStart, onDragEnd, isActive }: TaskCardProps) {
  const { updateTask } = useTasks();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const toggleComplete = (value: boolean) => {
    updateTask({ ...item, isCompleted: value });
  };

  const isPastDue = !!item.dueDate && !item.isCompleted && new Date(item.dueDate).getTime() < Date.now();


  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const textStyle = item.isCompleted ? { textDecorationLine: "line-through" as const, color: "#999999" } : {};

  return (
    <TouchableOpacity
      style={[
        styles.taskCard,
        isActive && styles.draggingCard,
      ]}
      onPress={() => navigation.navigate("EditTask", { taskId: item.id })}
      onLongPress={() => onDelete(item.id, item.title)}
      activeOpacity={0.95}
    >
      <TouchableOpacity
        style={styles.checkboxWrapper}
        onPress={() => toggleComplete(!item.isCompleted)}
      >
        <Checkbox
          value={item.isCompleted || false}
          onValueChange={toggleComplete}
          disabled={isActive}
          color={item.isCompleted ? "#007AFF" : undefined}
        />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.taskTitle, textStyle]}>{item.title}</Text>
        {item.description && <Text style={[styles.taskDescription, textStyle]}>{item.description}</Text>}
        {item.dueDate && (
          <Text
            style={[
              styles.taskDueDate,
              textStyle,
              isPastDue && styles.taskDueDatePast,
            ]}
          >
            Due: {formatDate(item.dueDate)}
          </Text>
        )}      
      </View>

      {showDragHandle && (
        <TouchableOpacity
          onPressIn={onDragStart}
          onPressOut={onDragEnd}
          style={styles.dragHandle}
        >
          <Ionicons name="reorder-three" size={24} color="#616161ff" />
        </TouchableOpacity>
      )}

    </TouchableOpacity>
  );
}

// Custom comparator: re-render only when important fields change
function areEqual(prev: TaskCardProps, next: TaskCardProps) {
  // Always re-render if the item identity changed
  if (prev.item.id !== next.item.id) return false;

  // Re-render on visible state changes we care about
  if (prev.item.isCompleted !== next.item.isCompleted) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.showDragHandle !== next.showDragHandle) return false;

  // If parent changed handlers (rare) but we can ignore function identity in many cases.
  // If you pass new inline callbacks each render and want to re-render, include checks here.
  return true; // props considered equal -> skip render
}

// Export memoized component
const TaskCard = React.memo(TaskCardInner, areEqual);
export default TaskCard;

const styles = StyleSheet.create({
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  checkboxWrapper: {
    padding: 10,  // Larger touch area for checkbox
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  taskDueDate: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  taskDueDatePast: {
    color: "#d32f2f", 
  },
  dragHandle: {
    marginLeft: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draggingCard: {
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: '#f9f9f9',
  },
});