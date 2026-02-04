import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Checkbox from "expo-checkbox";
import { Ionicons } from "@expo/vector-icons";
import { useTasks } from "../context/TaskContext";
import { useTheme } from "../context/ThemeContext";
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
  onPress?: () => void;
  onLongPress?: (id: string) => void;
  showDragHandle?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isActive?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  backgroundColor?: string;
  isFirstInList?: boolean;
  isLastInList?: boolean;
};

function TaskCardInner({ 
  item, 
  onPress, 
  onLongPress, 
  showDragHandle = false, 
  onDragStart, 
  onDragEnd, 
  isActive, 
  selected,
  selectionMode = false,
  backgroundColor,
  isFirstInList,
  isLastInList,
}: TaskCardProps) {
  const { updateTask } = useTasks();
  const { theme } = useTheme();
  const styles = makeStyles(theme, isLastInList ?? false);

  const iconMutedColor = theme.name === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';

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

  const textStyle = item.isCompleted ? { textDecorationLine: "line-through" as const, color: theme.muted } : {};

  return (
    <TouchableOpacity
      style={[
        styles.taskCard,
        backgroundColor && { backgroundColor },
        isActive && styles.draggingCard,
        isFirstInList && styles.taskCardFirst,
        isLastInList && styles.taskCardLast,
      ]}
      onPress={onPress}
      onLongPress={() => onLongPress(item.id)}
      activeOpacity={0.95}
    >
      <TouchableOpacity
        style={styles.checkboxWrapper}
        onPress={() => {
          if (selectionMode) {
            onPress?.();
          } else {
            toggleComplete(!item.isCompleted);
          }
        }}
      >
        <Checkbox
          value={item.isCompleted || false}
          onValueChange={toggleComplete}
          disabled={isActive}
          color={item.isCompleted ? theme.primary : iconMutedColor}
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
          <Ionicons name="reorder-three" size={24} color={iconMutedColor} />
        </TouchableOpacity>
      )}

      {selected && (
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={16} color={theme.text} />
          </View>
        </View>
      )}

    </TouchableOpacity>
  );
}

function areEqual(prev: TaskCardProps, next: TaskCardProps) {
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.isCompleted !== next.item.isCompleted) return false;
  // Compare displayed task fields so card re-renders when task is updated (e.g. from EditTaskScreen)
  if (prev.item.title !== next.item.title) return false;
  if (prev.item.description !== next.item.description) return false;
  if (prev.item.dueDate !== next.item.dueDate) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.showDragHandle !== next.showDragHandle) return false;
  if (!!prev.selected !== !!next.selected) return false;
  if (!!prev.selectionMode !== !!next.selectionMode) return false;
  if (prev.backgroundColor !== next.backgroundColor) return false;
  if (!!prev.isFirstInList !== !!next.isFirstInList) return false;
  if (!!prev.isLastInList !== !!next.isLastInList) return false;
  return true; // equal -> skip render
}


// Export memoized component
const TaskCard = React.memo(TaskCardInner, areEqual);
export default TaskCard;

const makeStyles = (theme: any, isLastInList: boolean) =>
  StyleSheet.create({
    taskCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      boxSizing: 'border-box',
      padding: 16,
      marginHorizontal: 16,
      borderBottomWidth: isLastInList ? 0 : 0.5,
      borderBottomColor: theme.border,
    },
    taskCardFirst: {
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    },
    taskCardLast: {
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },
    checkboxWrapper: {
      padding: 10,
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
      color: theme.text,
      marginBottom: 4,
    },
    taskDescription: {
      fontSize: 14,
      color: theme.muted,
      marginBottom: 8,
    },
    taskDueDate: {
      fontSize: 13,
      color: theme.dueDateText,
      fontWeight: "600",
    },
    taskDueDatePast: {
      color: theme.dueDateText, 
      fontWeight: "600",
    },
    dragHandle: {
      marginLeft: 12,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      color: theme.surface,
    },
    draggingCard: {
      elevation: 0,
    },
    checkWrap: {
      position: 'absolute',
      right: '8%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#2ecc71', // green
      justifyContent: 'center',
      alignItems: 'center',
    },
  });