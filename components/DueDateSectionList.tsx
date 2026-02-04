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
  
  const gradientTheme = useMemo(() => {
    const bases = getGradientThemeBases(themeColor);
    const base = scheme === 'dark' ? bases.dark : bases.light;
    return generateThemeColors(base, scheme);
  }, [scheme, themeColor]);

  const getCardBackgroundColor = (stableIndex: number, totalCount: number): string | undefined => {
    if (themeColor === 'default') return undefined;
    return gradientTheme.getItemColor(stableIndex, totalCount);
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      extraData={tasks}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      renderItem={({ item, index, section }) => {
        // Calculate stable index based on all tasks (not just section)
        const stableIndex = getStableIndex(tasks, item.id);
        const backgroundColor = getCardBackgroundColor(stableIndex, tasks.length);
        const isFirstInList = index === 0;
        const isLastInList = index === section.data.length - 1;
        return (
          <TaskCard
            item={item}
            showDragHandle={false}
            onPress={() => onPress(item.id)}
            onLongPress={() => onLongPress(item.id)}
            selected={selectedIds.includes(item.id)}
            selectionMode={selectionMode}
            backgroundColor={backgroundColor}
            isFirstInList={isFirstInList}
            isLastInList={isLastInList}
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
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 20,
      marginBottom: 4,
    },
  });
