import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
  Share,
  TextInput,
  BackHandler,
} from "react-native";
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
    addTask,
    addTaskList,
    deleteTask,
    reorderTasks
  } = useTasks();

  const [sortOption, setSortOption] = useState<SortOption>('custom');

  // local UI state: show/hide completed tasks
  const [showCompleted, setShowCompleted] = useState<boolean>(true);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const isSelectionMode = selectedTaskIds.length > 0;
  const clearSelection = useCallback(() => setSelectedTaskIds([]), []);
  const insets = useSafeAreaInsets();

  const [multiModalVisible, setMultiModalVisible] = useState(false);
  const [multiTitle, setMultiTitle] = useState('');
  const [multiAdded, setMultiAdded] = useState<string[]>([]);
  const multiInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        clearSelection();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [isSelectionMode, clearSelection]);

  useEffect(() => {
    if (taskLists.length > 0 && !currentTaskList) {
      setCurrentTaskList(taskLists[0].id);
    }
  }, [taskLists, currentTaskList]);

  // displayedTasks: filter by list, optionally hide completed, then apply sort
  const displayedTasks = useMemo(() => {
    if (!currentTaskListId) return [];

    // base: tasks for current list
    let listTasks = tasks.filter(t => t.tasklistId === currentTaskListId);

    // filter out completed tasks if showCompleted is false
    if (!showCompleted) {
      listTasks = listTasks.filter(t => !t.isCompleted);
    }

    // apply sorting when requested (non-destructive)
    switch (sortOption) {
      case 'dueDateAsc':
        listTasks = listTasks.slice().sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;

      case 'dueDateDesc':
        listTasks = listTasks.slice().sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        });
        break;

      case 'createdAtAsc':
        listTasks = listTasks.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;

      case 'createdAtDesc':
        listTasks = listTasks.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;

      case 'custom':
      default:
        // keep original order
        break;
    }

    return listTasks;
  }, [tasks, currentTaskListId, sortOption, showCompleted]);

  const activeIndex = useMemo(() => {
    if (!currentTaskList) return 0;
    return taskLists.findIndex(t => t.id === currentTaskList.id);
  }, [taskLists, currentTaskList]);

  const toggleSelectTask = useCallback((id: string) => {
    setSelectedTaskIds(prev => {
      const exists = prev.includes(id);
      if (exists) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert("Delete Task", `Are you sure you want to delete?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask(id) },
    ]);
  }, [deleteTask]);

  const handleLongPress = useCallback((id: string) => {
    toggleSelectTask(id);
  }, [toggleSelectTask]);

  const selectSort = (option: SortOption) => {
    setSortOption(option);
  };

  const addMultiTask = async () => {
    const trimmed = multiTitle.trim();
    if (!trimmed) return;

    if (!currentTaskListId) {
      Alert.alert('No list selected', 'Please select a task list first.');
      return;
    }

    try {
      await addTask({
        title: trimmed,
        tasklistId: currentTaskListId,
        description: undefined,
      });
      // record what we just added in the session
      setMultiAdded(prev => [trimmed, ...prev]);
      setMultiTitle('');
      // keep focus in the input for quick multi-add
      setTimeout(() => multiInputRef.current?.focus(), 50);
    } catch (err) {
      console.error('Failed adding task', err);
      Alert.alert('Error', 'Failed to add task.');
    }
  };

  const renderDragListItem = (info: DragListRenderItemInfo<typeof tasks[0]>) => {
    const { item, onDragStart, onDragEnd, isActive } = info;
    return (
      <TaskCard
        key={item.id}
        item={item}
        onPress={() => {
          if (isSelectionMode) {
            toggleSelectTask(item.id);
          } else {
            navigation.navigate('EditTask', { taskId: item.id });
          }
        }}
        onLongPress={() => handleLongPress(item.id)}
        showDragHandle={true}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        isActive={isActive}
        selected={selectedTaskIds.includes(item.id)}
        selectionMode={isSelectionMode}
      />
    );
  };

  const onReordered = (fromIndex: number, toIndex: number) => {
    const copy = [...displayedTasks];
    const [removed] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, removed);
    reorderTasks(copy);
  };

  // compute filter menu items so label updates with showCompleted
  const filterMenuItems = [
    { label: 'Custom sort', onPress: () => selectSort('custom') },
    { label: 'Sort by due date ↑', onPress: () => selectSort('dueDateAsc') },
    // other sorts...
    { label: 'Sort by creation ↓', onPress: () => selectSort('createdAtDesc') },
    {
      label: showCompleted ? 'Hide completed tasks' : 'Show completed tasks',
      onPress: () => setShowCompleted(prev => !prev),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ position: 'relative', zIndex: 10 }}>
        {isSelectionMode ? (
          <View style={styles.contextBar}>
            <TouchableOpacity
              onPress={clearSelection}
              style={styles.contextIcon}
              accessibilityLabel="Cancel selection"
            >
              <Ionicons name="close" size={24} />
            </TouchableOpacity>

            <Text style={{ fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
              {selectedTaskIds.length} selected
            </Text>

            <View style={styles.contextActions}>
              <TouchableOpacity
                style={styles.contextButton}
                onPress={async () => {
                  const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
                  if (selectedTasks.length === 0) return;

                  const taskLines = selectedTasks.map(task => {
                    let line = `• ${task.title}`;
                    if (task.description) line += ` - ${task.description}`;
                    if (task.dueDate) {
                      const dueDate = new Date(task.dueDate);
                      const formattedDate = dueDate.toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                      });
                      line += ` (Due: ${formattedDate})`;
                    }
                    return line;
                  });

                  const shareText = `${currentTaskList?.title ?? ''}\n\n${taskLines.join('\n')}`;

                  try {
                    await Share.share({ message: shareText });
                  } catch (err) {
                    console.debug('Share cancelled/failed', err);
                  } finally {
                    clearSelection();
                  }
                }}
              >
                <Ionicons name="share-outline" size={22} />
                <Text style={styles.contextText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contextButton}
                onPress={() => {
                  Alert.alert(
                    'Delete tasks',
                    `Delete ${selectedTaskIds.length} task(s)?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          selectedTaskIds.forEach(id => deleteTask(id));
                          clearSelection();
                        }
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <Text style={[styles.contextText, { color: '#FF3B30' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TopBar
            title={'My Tasks'}
            leftIcon={require('../assets/default-profile.png')}
            onLeftIconPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            rightIcon1={<Ionicons name="sync" size={20} />}
            rightIcon2={<Ionicons name="filter" size={20} />}
            rightIcon3={<Ionicons name="ellipsis-vertical-outline" size={20} />}
            filterMenuItems={filterMenuItems}
            otherMenuItems={[
              { label: 'Add multiple tasks', onPress: () => setMultiModalVisible(true) },
              { label: 'Clear completed tasks', onPress: () => { /* implement if you want hard delete */ } },
              { label: 'View completed tasks', onPress: () => { /* optional */ } },
              { label: 'Manage task lists', onPress: () => { navigation.navigate('TaskList') } },
              {
                label: 'Share task list', onPress: async () => {
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
                        month: 'long',
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
        )}
      </View>

      <HorizontalScrollWithUnderline
        taskLists={taskLists}
        selectedIndex={activeIndex}
        onActiveChange={(index) => {
          if (index < 0 || index >= taskLists.length) return;
          setCurrentTaskList(taskLists[index].id);
        }}
      />

      {/* Add multiple tasks modal */}
      <Modal
        animationType="slide"
        transparent
        visible={multiModalVisible}
        onRequestClose={() => setMultiModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add multiple tasks</Text>

            <TextInput
              ref={(r) => { multiInputRef.current = r; }}
              placeholder="Task title"
              value={multiTitle}
              onChangeText={setMultiTitle}
              style={styles.input}
              autoFocus
              onSubmitEditing={addMultiTask}
              returnKeyType="done"
            />

            {multiAdded.length !== 0 &&
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: '#666' }}>
                  Added: {multiAdded.length}
                </Text>
                {multiAdded.length > 0 && (
                  <Text style={{ marginTop: 6, color: '#444' }}>
                    {multiAdded.slice(0, 5).join(', ')}{multiAdded.length > 5 ? ` +${multiAdded.length - 5}` : ''}
                  </Text>
                )}
              </View>
            }

            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={() => { setMultiModalVisible(false); setMultiTitle(''); setMultiAdded([]); }}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>

              <Pressable style={[styles.modalButton, styles.modalPrimary]} onPress={addMultiTask}>
                <Text style={[styles.modalButtonText, styles.modalPrimaryText]}>Add</Text>
              </Pressable>

              <Pressable style={[styles.modalButton, styles.modalPrimary, { marginLeft: 8 }]} onPress={() => { setMultiModalVisible(false); setMultiTitle(''); setMultiAdded([]); }}>
                <Text style={[styles.modalButtonText, styles.modalPrimaryText]}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {displayedTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tasks yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
        </View>
      ) : sortOption === 'custom' ? (
        <View style={{ flex: 1 }}>
          <DragList
            data={displayedTasks}
            keyExtractor={(it) => it.id}
            renderItem={renderDragListItem}
            onReordered={onReordered}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : sortOption === 'dueDateAsc' ? (
        <DueDateSectionList
          tasks={displayedTasks}
          selectedIds={selectedTaskIds}
          onPress={(id: string) => {
            if (isSelectionMode) toggleSelectTask(id);
            else navigation.navigate('EditTask', { taskId: id });
          }}
          onLongPress={(id: string) => handleLongPress(id)}
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
              onPress={() => {
                if (isSelectionMode) toggleSelectTask(item.id);
                else navigation.navigate('EditTask', { taskId: item.id });
              }}
              onLongPress={() => handleLongPress(item.id)}
              selected={selectedTaskIds.includes(item.id)}
              selectionMode={isSelectionMode}
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

  contextBar: {
    height: 56,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    elevation: 4,
  },

  contextIcon: {
    padding: 8,
  },

  contextActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },

  contextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },

  contextText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '500',
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
  actionRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8
  },

  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8
  },

  actionText: {
    marginTop: 4,
    fontSize: 14,
    color: '#000',
  },

  /* modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 8, paddingHorizontal: 12 },
  modalPrimary: { backgroundColor: '#0b6efd', borderRadius: 8, marginLeft: 8 },
  modalButtonText: { color: '#333', fontWeight: '600' },
  modalPrimaryText: { color: '#fff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
});