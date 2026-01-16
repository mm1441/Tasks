// components/DueDateSectionList.tsx
import React from 'react';
import { SectionList, Text, View, StyleSheet, ViewStyle } from 'react-native';
import type { Task } from '../types/Task';
import TaskCard from './TaskCard';
import { buildDueDateSections } from '../utils/buildDueDateSections';
import { useTheme } from '../context/ThemeContext';

type Section = {
  title: string;
  data: Task[];
};

interface Props {
  tasks: Task[];
  style?: ViewStyle;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  selectedIds?: string[]; // optional to display selected state
  selectionMode?: boolean;
}

export default function DueDateSectionList({
  tasks,
  onPress,
  onLongPress,
  selectedIds = [],
  selectionMode
}: Props) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const sections: Section[] = buildDueDateSections(tasks);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <TaskCard
          item={item}
          showDragHandle={false}
          onPress={() => onPress(item.id)}
          onLongPress={() => onLongPress(item.id)}
          selected={selectedIds.includes(item.id)}
          selectionMode={selectionMode}
        />
      )}
    />
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    listContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.muted,
      marginTop: 16,
      marginBottom: 8,
    },
  });
