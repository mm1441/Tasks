import React from 'react';
import { SectionList, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { Task } from '../types/Task';
import TaskCard from './TaskCard';
import { buildDueDateSections } from '../utils/buildDueDateSections';

interface Props {
  tasks: Task[];
  style?: ViewStyle;
  onDelete: (id: string, title: string) => void;
}

export default function DueDateSectionList({ tasks, onDelete }: Props) {
  const sections = buildDueDateSections(tasks);

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
          onLongPress={onDelete}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
});
