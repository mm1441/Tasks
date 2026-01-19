import { useState, useEffect } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskCard from './TaskCard';
import { useTheme } from '../context/ThemeContext';
import type { Task } from '../types/Task';

interface Props {
  tasks: Task[];
  isSelectionMode: boolean;
  selectedTaskIds: string[];
  onPressTask: (id: string) => void;
  onLongPressTask: (id: string) => void;
}

export default function CompletedTasksFooter({
  tasks,
  isSelectionMode,
  selectedTaskIds,
  onPressTask,
  onLongPressTask,
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);

  // Auto-open when tasks appear
  useEffect(() => {
    if (tasks.length > 0) setOpen(true);
  }, [tasks.length]);

  if (tasks.length === 0) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={({ pressed }) => [
          styles.header,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.title}>
          Completed tasks ({tasks.length})
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text}
        />
      </Pressable>

      {open && (
        <View style={{ marginTop: 8 }}>
          <FlatList
            data={tasks}
            keyExtractor={(t) => t.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TaskCard
                item={item}
                showDragHandle={false}
                onPress={() => onPressTask(item.id)}
                onLongPress={() => onLongPressTask(item.id)}
                selected={selectedTaskIds.includes(item.id)}
                selectionMode={isSelectionMode}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
  });

