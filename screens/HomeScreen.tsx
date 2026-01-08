import { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, FlatList, Dimensions, Share } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from "../context/TaskContext";
import { TopBar } from "../components/TopBar";
import { DrawerActions } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DragList, { DragListRenderItemInfo } from "react-native-draglist";
import TaskCard from "../components/TaskCard";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import HorizontalScrollWithUnderline from "../components/HorizontalScrollWithUnderline";
import DueDateSectionList from "../components/DueDateSectionList";


type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};
type SortOption = 'custom' | 'dueDateAsc' | 'dueDateDesc' | 'createdAtAsc' | 'createdAtDesc' | null;
const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

export default function HomeScreen({ navigation }: HomeScreenProps) {

  const { 
    tasks, 
    taskLists, 
    currentTaskList, 
    currentTaskListId, 
    setCurrentTaskList, 
    addTaskList, 
    deleteTask, 
    reorderTasks 
  } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('custom');
  const insets = useSafeAreaInsets();

  // When taskLists load or change, ensure we have a selected/current list
  useEffect(() => {
    if (taskLists.length > 0 && !currentTaskList) {
      setCurrentTaskList(taskLists[0].id);
    }
    // If you want to preserve user's last selection across mounts,
    // load it from storage and set it here instead.
  }, [taskLists, currentTaskList]);

  // useEffect(() => {
  //   console.debug("HomeScreen sees lists:", taskLists.map(t => t.title));
  //   console.debug("HomeScreen current list:", currentTaskList?.title);
  // }, [taskLists, currentTaskList]);

  const displayedTasks = useMemo(() => {
    if (!currentTaskListId) return [];
    return tasks.filter(t => t.tasklistId === currentTaskListId);
  }, [tasks, currentTaskListId, sortOption]);

  const activeIndex = useMemo(() => {
    if (!currentTaskList) return 0;
    return taskLists.findIndex(t => t.id === currentTaskList.id);
  }, [taskLists, currentTaskList]);

  const renderDragListItem = (info: DragListRenderItemInfo<typeof tasks[0]>) => {
    const { item, onDragStart, onDragEnd, isActive } = info;
    return (
      <TaskCard
        key={item.id}
        item={item}
        onLongPress={handleLongPress}
        showDragHandle={true}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        isActive={isActive}
      />
    );
  };

  const onReordered = (fromIndex: number, toIndex: number) => {
    const copy = [...displayedTasks];
    const [removed] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, removed);
    reorderTasks(copy);
  };

  const handleDelete = useCallback((id: string, title: string) => {
    Alert.alert("Delete Task", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask(id) },
    ]);
  }, [deleteTask]);

  const handleLongPress = useCallback((id: string) => {
    setSelectedTaskId(id);
  }, []);

  const selectSort = (option: SortOption) => {
    setSortOption(option);
  };

  return (
    <SafeAreaView
      style={styles.container}>
      <TopBar title={'My Tasks'}
        leftIcon={require('../assets/default-profile.png')}
        onLeftIconPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        rightIcon1={<Ionicons name="sync" size={20} />}
        rightIcon2={<Ionicons name="filter" size={20} />}
        rightIcon3={<Ionicons name="ellipsis-vertical-outline" size={20} />}
        filterMenuItems={[
          { label: 'Custom sort', onPress: () => selectSort('custom') },
          { label: 'Sort by due date ↑', onPress: () => selectSort('dueDateAsc') },
          // { label: 'Sort by due date ↓', onPress: () => selectSort('dueDateDesc') },
          // { label: 'Sort by creation ↑', onPress: () => selectSort('createdAtAsc') },
          { label: 'Sort by creation ↓', onPress: () => selectSort('createdAtDesc') },
          // { label: 'Clear sort', onPress: () => selectSort('createdAtDesc') },
        ]}
        otherMenuItems={[
          { label: 'Add multiple tasks', onPress: () => { } },
          { label: 'Clear completed tasks', onPress: () => { } },
          { label: 'View completed tasks', onPress: () => { } },
          { label: 'Manage task lists', onPress: () => { navigation.navigate('TaskList')}},
          {
            label: 'Share task lists', onPress: async () => {
              if (!currentTaskList || displayedTasks.length === 0) {
                Alert.alert('No tasks', 'There are no tasks to share in this list.');
                return;
              }

              const taskLines = displayedTasks.map(task => {
                let line = task.title;

                if (task.description) {
                  line += ` - ${task.description}`;
                }

                if (task.dueDate) {
                  const dueDate = new Date(task.dueDate);
                  const formattedDate = dueDate.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                  });
                  line += ` (Due: ${formattedDate})`;
                }

                return line;
              });

              const shareText = `${currentTaskList.title}\n\n${taskLines.join('\n')}`;

              try {
                await Share.share({
                  message: shareText,
                });
              } catch (error) {
                Alert.alert('Sharing failed', 'Unable to share the task list.');
              }
            }
          },
        ]}
      />
      <HorizontalScrollWithUnderline
        taskLists={taskLists}
        selectedIndex={activeIndex}
        onActiveChange={(index) => {
          if (index < 0 || index >= taskLists.length) return;
          setCurrentTaskList(taskLists[index].id);
        }}
      />


      {selectedTaskId && (
        <Modal
          transparent
          visible={!!selectedTaskId}
          animationType="fade"
          onRequestClose={() => setSelectedTaskId(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedTaskId(null)}>
            <View style={styles.actionRow} onStartShouldSetResponder={() => true}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  const task = tasks.find(t => t.id === selectedTaskId);
                  if (task) {
                    await Share.share({
                      message: `${task.title}\n${task.description || ''}`,
                    });
                  }
                  setSelectedTaskId(null);
                }}
              >
                <Ionicons name="share-outline" size={24} color="#007AFF" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  deleteTask(selectedTaskId);
                  setSelectedTaskId(null);
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      {displayedTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tasks yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
        </View>
      ) : sortOption === 'custom' ? (
        <DragList
          data={displayedTasks}
          keyExtractor={(it) => it.id}
          renderItem={renderDragListItem}
          onReordered={onReordered}
          containerStyle={{ padding: 16 }}
        />
      ) : sortOption === 'dueDateAsc' ? (
        <DueDateSectionList
          tasks={displayedTasks}
          onDelete={(id: string) => handleLongPress(id)}
        />
      ) : (
        <FlatList
          data={displayedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TaskCard
              item={item}
              showDragHandle={false}
              onLongPress={() => handleLongPress(item.id)}
            />
          )}
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddTask', { taskListId: currentTaskList?.id })}
        accessibilityLabel="Add task"
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabsWrap: {
    height: 72,
    justifyContent: 'center',
  },
  tabItem: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  tabMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  underline: {
    position: 'absolute',
    bottom: 10,
    width: 72,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#007AFF',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  cancelButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 6,
    flex: 1
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  taskDueDate: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbbbbb',
  },
  addButton: {
    position: 'absolute',
    right: width * 0.1,
    bottom: height * 0.1,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  addButtonText: {
    fontSize: 32,
    color: '#fff',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },

  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  actionText: {
    marginTop: 4,
    fontSize: 14,
    color: '#000',
  },
});