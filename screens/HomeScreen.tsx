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
import { useTheme } from "../context/ThemeContext";
import { useGoogleAuth } from "../context/GoogleAuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { TopBar } from "../components/TopBar";
import { DrawerActions } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DragList, { DragListRenderItemInfo } from "react-native-draglist";
import TaskCard from "../components/TaskCard";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import HorizontalScrollWithUnderline from "../components/HorizontalScrollWithUnderline";
import DueDateSectionList from "../components/DueDateSectionList";
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthService } from "../services/googleAuth";
import * as WebBrowser from 'expo-web-browser';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};
type SortOption = 'custom' | 'dueDateAsc' | 'dueDateDesc' | 'createdAtAsc' | 'createdAtDesc' | null;
const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');
WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const {
    tasks,
    addTask,
    deleteTask,
    reorderTasks,
    taskLists,
    setCurrentTaskList,
    addTaskList,
    currentTaskList,
    currentTaskListId,
    syncWithGoogle,
    syncStatus,
    syncError,
  } = useTasks();
  const { theme } = useTheme();
  const { isAuthenticated, isLoading: authLoading, signIn, getAccessToken } = useGoogleAuth();
  const { isOnline } = useNetworkStatus();
  const styles = makeStyles(theme);

  const [sortOption, setSortOption] = useState<SortOption>('custom');
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const isSelectionMode = selectedTaskIds.length > 0;
  const clearSelection = useCallback(() => setSelectedTaskIds([]), []);
  const insets = useSafeAreaInsets();

  const [multiModalVisible, setMultiModalVisible] = useState(false);
  const [multiTitle, setMultiTitle] = useState('');
  const [multiAdded, setMultiAdded] = useState<string[]>([]);
  const multiInputRef = useRef<TextInput | null>(null);

  // const authService = GoogleAuthService.getInstance();

  // useEffect(() => {
  //   if (response?.type === 'success') {
  //     const { authentication } = response;
  //     if (authentication) {
  //       // Send the result to your service
  //       authService.setTokensFromAuthResult(authentication)
  //         .then(() => {
  //           console.log('Login successful, tokens saved!');
  //           // Navigate to home or whatever
  //         })
  //         .catch(err => console.error('Failed to save tokens:', err));
  //     }
  //   } else if (response?.type === 'error') {
  //     console.error('Auth error:', response.error);
  //   }
  // }, [response]);

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

  const displayedTasks = useMemo(() => {
    if (!currentTaskListId) return [];
    let listTasks = tasks.filter(t => t.tasklistId === currentTaskListId);
    if (!showCompleted) 
      listTasks = listTasks.filter(t => !t.isCompleted);
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

  const selectSort = (option: SortOption) => {
    setSortOption(option);
  };

  const handleSync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'You need to be connected to the internet to sync.');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in with Google to sync your tasks.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: async () => {
              try {
                // console.debug(request?.clientId)
                // console.debug(`Redirect URI: ${request?.redirectUri}`)
                //promptAsync(); // new
                await signIn();
                const token = await getAccessToken();
                // After sign in, trigger sync
                if (token) {
                  console.debug('token', token);
                  handleSyncWithToken(token);
                }
              } catch (error) {
                Alert.alert('Sign In Failed', error instanceof Error ? error.message : 'Failed to sign in');
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        Alert.alert('Error', 'Failed to get access token. Please sign in again.');
        return;
      }
      console.debug(token)
      await handleSyncWithToken(token);
    } catch (error) {
      Alert.alert('Sync Failed', error instanceof Error ? error.message : 'Failed to sync tasks');
    }
  }, [isOnline, isAuthenticated, signIn, getAccessToken]);

  const handleSyncWithToken = async (accessToken: string) => {
    try {
      await syncWithGoogle(accessToken, (message) => {
        console.log('Sync progress:', message);
      });
      if (syncError) {
        Alert.alert('Sync Error', syncError);
      }
    } catch (error) {
      Alert.alert('Sync Failed', error instanceof Error ? error.message : 'Failed to sync tasks');
    }
  };

  const shareTaskList = async () => {
    if (!currentTaskList || displayedTasks.length === 0) {
      Alert.alert('No tasks', 'There are no tasks to share in this list.');
      return;
    }

    let tasksToShare = displayedTasks;
    const selectedTasks = displayedTasks.filter(t => selectedTaskIds.includes(t.id));
    if (selectedTasks.length !== 0) {
      tasksToShare = selectedTasks;
    }

    const taskLines = tasksToShare.map(task => {
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
        onLongPress={() => toggleSelectTask(item.id)}
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

  const filterMenuItems = [
    { label: 'Custom sort', onPress: () => selectSort('custom') },
    { label: 'Sort by due date ↑', onPress: () => selectSort('dueDateAsc') },
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
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>

            <Text style={[styles.contextText, { fontSize: 16, fontWeight: '600', marginLeft: 8 }]}>
              {selectedTaskIds.length} selected
            </Text>

            <View style={styles.contextActions}>
              <TouchableOpacity
                style={styles.contextButton}
                onPress= {() => { shareTaskList(); }} // ToDo: Share only selected tasks
              >
                <Ionicons name="share-outline" size={22} color={theme.text} />
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
            rightIcon1={
              <Ionicons 
                name={syncStatus === 'syncing' ? 'sync' : 'sync-outline'} 
                size={20} 
                color={
                  !isOnline 
                    ? theme.muted 
                    : syncStatus === 'syncing' 
                    ? theme.primary 
                    : syncStatus === 'error' 
                    ? '#FF3B30' 
                    : theme.text
                }
              />
            }
            onRightIcon1Press={handleSync}
            rightIcon2={<Ionicons name="filter" size={20} color={theme.text}/>}
            rightIcon3={<Ionicons name="ellipsis-vertical-outline" size={20} color={theme.text}/>}
            filterMenuItems={filterMenuItems}
            otherMenuItems={[
              // { label: 'Clear completed tasks', onPress: () => { /* implement if you want hard delete */ } },
              // { label: 'View completed tasks', onPress: () => { /* optional */ } },
              { label: 'Add multiple tasks', onPress: () => setMultiModalVisible(true) },
              { label: 'Manage task lists', onPress: () => { navigation.navigate('TaskList'); } },
              { label: 'Share task list', onPress: () => { shareTaskList(); }}
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
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  Added: {multiAdded.length}
                </Text>
                {multiAdded.length > 0 && (
                  <Text style={{ marginTop: 6, color: theme.text }}>
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
          onLongPress={(id: string) => toggleSelectTask(id)}
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
                if (isSelectionMode) 
                  toggleSelectTask(item.id);
                else 
                  navigation.navigate('EditTask', { taskId: item.id });
              }}
              onLongPress={() => toggleSelectTask(item.id)}
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

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    tabsWrap: {
      height: 72,
      justifyContent: 'center',
    },
    tabItem: {
      height: 56,
      borderRadius: 12,
      backgroundColor: theme.surface,
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
      color: theme.text,
    },
    tabMeta: {
      fontSize: 12,
      color: theme.muted,
      marginTop: 4,
    },

    underline: {
      position: 'absolute',
      bottom: 10,
      width: 72,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.primary,
    },

    contextBar: {
      height: 56,
      backgroundColor: theme.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
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
      color: theme.text,
    },

    cancelButton: {
      marginLeft: 8,
      paddingHorizontal: 8,
    },
    cancelText: {
      color: theme.primary,
      fontWeight: '600',
    },
    listContent: {
      paddingVertical: 6,
    },
    taskCard: {
      backgroundColor: theme.surface,
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
      color: theme.primary,
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
      color: theme.muted,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.muted,
    },
    addButton: {
      position: 'absolute',
      right: width * 0.1,
      bottom: height * 0.1,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
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
      backgroundColor: theme.surface,
      paddingVertical: 10,
      borderRadius: 8
    },

    actionButton: {
      alignItems: 'center',
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8
    },

    actionText: {
      marginTop: 4,
      fontSize: 14,
      color: theme.text,
    },

    /* modal */
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: theme.text },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: theme.surface,
      color: theme.text,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    modalButton: { paddingVertical: 8, paddingHorizontal: 12 },
    modalPrimary: { backgroundColor: theme.primary, borderRadius: 8, marginLeft: 8 },
    modalButtonText: { color: theme.text, fontWeight: '600' },
    modalPrimaryText: { color: '#fff' },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      padding: 20,
    },
  });