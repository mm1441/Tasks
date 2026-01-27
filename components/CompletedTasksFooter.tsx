import { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TaskCard from './TaskCard';
import { useTheme } from '../context/ThemeContext';
import type { Task } from '../types/Task';
import { generateThemeColors, getStableIndex } from '../utils/themeColors';
import { getGradientThemeBases } from '../theme/colors';

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
  const { theme, scheme, themeColor } = useTheme();
  const styles = makeStyles(theme);
  const [open, setOpen] = useState(false);

  // Generate theme colors for gradient effect (separate gradient for completed tasks, theme-specific)
  const gradientTheme = useMemo(() => {
    const bases = getGradientThemeBases(themeColor);
    const base = scheme === 'dark' ? bases.dark : bases.light;
    return generateThemeColors(base);
  }, [scheme, themeColor]);

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
            renderItem={({ item }) => {
              // Calculate stable index for completed tasks (separate gradient that restarts)
              const stableIndex = getStableIndex(tasks, item.id);
              const backgroundColor = gradientTheme.getItemColor(stableIndex, tasks.length);
              return (
                <TaskCard
                  item={item}
                  showDragHandle={false}
                  onPress={() => onPressTask(item.id)}
                  onLongPress={() => onLongPressTask(item.id)}
                  selected={selectedTaskIds.includes(item.id)}
                  selectionMode={isSelectionMode}
                  backgroundColor={backgroundColor}
                />
              );
            }}
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
      paddingHorizontal: 16,
      height: 48,

    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
  });

