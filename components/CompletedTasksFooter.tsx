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
  onClearCompleted?: () => void;
}

export default function CompletedTasksFooter({
  tasks,
  isSelectionMode,
  selectedTaskIds,
  onPressTask,
  onLongPressTask,
  onClearCompleted,
}: Props) {
  const { theme, scheme, themeColor } = useTheme();
  const styles = makeStyles(theme, scheme);
  const [open, setOpen] = useState(false);

  // Generate theme colors for gradient effect (separate gradient for completed tasks, theme-specific)
  const gradientTheme = useMemo(() => {
    const bases = getGradientThemeBases(themeColor);
    const base = scheme === 'dark' ? bases.dark : bases.light;
    return generateThemeColors(base, scheme);
  }, [scheme, themeColor]);

  const getCardBackgroundColor = (stableIndex: number, totalCount: number): string | undefined => {
    if (themeColor === 'default') return undefined;
    return gradientTheme.getItemColor(stableIndex, totalCount);
  };

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
            renderItem={({ item, index }) => {
              const stableIndex = getStableIndex(tasks, item.id);
              const backgroundColor = getCardBackgroundColor(stableIndex, tasks.length);
              const isFirstInList = index === 0;
              const isLastInList = index === tasks.length - 1;
              return (
                <TaskCard
                  item={item}
                  showDragHandle={false}
                  onPress={() => onPressTask(item.id)}
                  onLongPress={() => onLongPressTask(item.id)}
                  selected={selectedTaskIds.includes(item.id)}
                  selectionMode={isSelectionMode}
                  backgroundColor={backgroundColor}
                  isFirstInList={isFirstInList}
                  isLastInList={isLastInList}
                />
              );
            }}
          />
          {onClearCompleted && (
            <Pressable
              style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.8 }]}
              onPress={onClearCompleted}
            >
              <Ionicons name="trash-outline" size={16} color={theme.text} />
              <Text style={styles.clearButtonText}>Clear ALL completed tasks</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: any, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginTop: 10,
      height: 40,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
    clearButton: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      paddingVertical: 12,
      marginTop: 16,
      borderRadius: 8,
      backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: scheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
    },
  });

