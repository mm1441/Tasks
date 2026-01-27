// components/DueDateSectionList.tsx
import { ComponentType, ReactElement, ReactNode, useMemo } from 'react';
import { SectionList, Text, View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import type { Task } from '../types/Task';
import TaskCard from './TaskCard';
import { buildDueDateSections } from '../utils/buildDueDateSections';
import { useTheme } from '../context/ThemeContext';
import { generateThemeColors, getStableIndex } from '../utils/themeColors';
import { getGradientThemeBases } from '../theme/colors';

type Section = {
  title: string;
  data: Task[];
};

interface Props {
  tasks: Task[];
  style?: ViewStyle;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  selectedIds?: string[];
  selectionMode?: boolean;
  ListFooterComponent?: ComponentType<any> | ReactElement;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export default function DueDateSectionList({
  tasks,
  onPress,
  onLongPress,
  selectedIds = [],
  selectionMode,
  ListFooterComponent,
  contentContainerStyle,
}: Props) {
  const { theme, scheme, themeColor } = useTheme();
  const styles = makeStyles(theme);
  const sections: Section[] = buildDueDateSections(tasks);
  
  // Generate theme colors for gradient effect (theme-specific)
  const gradientTheme = useMemo(() => {
    const bases = getGradientThemeBases(themeColor);
    const base = scheme === 'dark' ? bases.dark : bases.light;
    return generateThemeColors(base);
  }, [scheme, themeColor]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      renderItem={({ item }) => {
        // Calculate stable index based on all tasks (not just section)
        const stableIndex = getStableIndex(tasks, item.id);
        const backgroundColor = gradientTheme.getItemColor(stableIndex, tasks.length);
        return (
          <TaskCard
            item={item}
            showDragHandle={false}
            onPress={() => onPress(item.id)}
            onLongPress={() => onLongPress(item.id)}
            selected={selectedIds.includes(item.id)}
            selectionMode={selectionMode}
            backgroundColor={backgroundColor}
          />
        );
      }}
    />
  );
}


const makeStyles = (theme: any) =>
  StyleSheet.create({
    listContent: {
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
      marginTop: 16,
      marginBottom: 8,
      padding: 16,
    },
  });
