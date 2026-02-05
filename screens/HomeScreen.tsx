// HomeScreen.tsx
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Pressable,
  FlatList,
  Dimensions,
  Share,
  TextInput,
  BackHandler,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Animated,
  Modal,
  ActivityIndicator,
  ToastAndroid,
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
import CompletedTasksFooter from "../components/CompletedTasksFooter";
import DeletedTasksFooter from "../components/DeletedTasksFooter";
import NewTaskListModal from "../components/NewTaskListModal";
import AddNewTaskDrawer from "../components/AddNewTaskDrawer";
import { generateThemeColors, getStableIndex } from "../utils/themeColors";
import { getGradientThemeBases } from "../theme/colors";

// WebBrowser.maybeCompleteAuthSession();

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

type SortOption = 'custom' | 'dueDateAsc' | 'dueDateDesc' | 'createdAtAsc' | 'createdAtDesc' | null;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const {
    tasks,
    addTask,
    deleteTask,
    permanentlyDeleteTask,
    reorderTasks,
    taskLists,
    setCurrentTaskList,
    addTaskList,
    currentTaskList,
    currentTaskListId,
    downloadFromGoogle,
    uploadToGoogle,
    syncStatus,
    syncError,
    showDeletedTasks,
    autoSyncEnabled,
    syncPriority,
  } = useTasks();
  
  const [newListModalVisible, setNewListModalVisible] = useState(false);
  const { theme, scheme, themeColor } = useTheme();
  const { isAuthenticated, isLoading: authLoading, signIn, getAccessToken, userInfo } = useGoogleAuth();
  const { isOnline } = useNetworkStatus();
  const styles = makeStyles(theme);

  // Generate theme colors for gradient effect (theme-specific)
  const gradientTheme = useMemo(() => {
    const bases = getGradientThemeBases(themeColor);
    const base = scheme === 'dark' ? bases.dark : bases.light;
    return generateThemeColors(base, scheme);
  }, [scheme, themeColor]);

  const [sortOption, setSortOption] = useState<SortOption>('dueDateAsc');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const isSelectionMode = selectedTaskIds.length > 0;
  const clearSelection = useCallback(() => setSelectedTaskIds([]), []);
  const insets = useSafeAreaInsets();

  const [isAddingTask, setIsAddingTask] = useState(false);

  // Sync modal state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncModalMessages, setSyncModalMessages] = useState<string[]>([]);
  const [syncModalError, setSyncModalError] = useState<string | null>(null);
  const [syncModalBusy, setSyncModalBusy] = useState(false);
  const lastSyncActionRef = useRef<(() => Promise<void>) | null>(null);

  // Inline status (toast fallback)
  const [inlineStatus, setInlineStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  useEffect(() => {
    if (!inlineStatus) return;
    const t = setTimeout(() => setInlineStatus(null), 4000);
    return () => clearTimeout(t);
  }, [inlineStatus]);


  useEffect(() => {
    if (taskLists.length > 0 && !currentTaskList) {
      setCurrentTaskList(taskLists[0].id);
    }
  }, [taskLists, currentTaskList]);

  // Auto-sync when switching task lists
  const isFirstAutoSyncRef = useRef(true);
  useEffect(() => {
    // Skip first mount to avoid syncing on app open
    if (isFirstAutoSyncRef.current) {
      isFirstAutoSyncRef.current = false;
      return;
    }
    if (!autoSyncEnabled || !isOnline || !isAuthenticated || !currentTaskList || syncStatus === 'syncing') {
      return;
    }

    const runAutoSync = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        if (syncPriority === 'cloud') {
          await downloadFromGoogle(token);
          await uploadToGoogle(token);
        } else {
          await uploadToGoogle(token);
          await downloadFromGoogle(token);
        }
      } catch (e) {
        console.warn('[HomeScreen] Auto-sync failed:', e);
      }
    };

    runAutoSync();
  }, [currentTaskListId]);

  const displayedTasks = useMemo(() => {
    if (!currentTaskListId) 
      return [];

    let listTasks = tasks.filter(t => 
      t.tasklistId === currentTaskListId && !t.isCompleted && !t.isDeleted
    );
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
        listTasks = listTasks.slice().sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'createdAtDesc':
        listTasks = listTasks.slice().sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'custom':
      default:
        break;
    }

    return listTasks;
  }, [tasks, currentTaskListId, sortOption]);

  const completedTasks = useMemo(() => {
    if (!currentTaskListId) return [];
    return tasks.filter(t => t.tasklistId === currentTaskListId && t.isCompleted && !t.isDeleted);
  }, [tasks, currentTaskListId]);

  const deletedTasks = useMemo(() => {
    if (!currentTaskListId) return [];
    const allTasks = tasks.length;
    const tasksWithIsDeleted = tasks.filter(t => t.isDeleted).length;
    const filtered = tasks.filter(t => t.tasklistId === currentTaskListId && t.isDeleted);
    console.log('[HomeScreen] deletedTasks computed:', filtered.length, 'tasks (total tasks:', allTasks, ', tasks with isDeleted:', tasksWithIsDeleted, ', currentListId:', currentTaskListId, ')');
    if (filtered.length > 0) {
      console.log('[HomeScreen] Deleted task IDs:', filtered.map(t => ({ id: t.id, title: t.title, isDeleted: t.isDeleted })));
    }
    return filtered;
  }, [tasks, currentTaskListId]);

  // Debug: Log when showDeletedTasks changes
  useEffect(() => {
    console.log('[HomeScreen] showDeletedTasks changed to:', showDeletedTasks);
    console.log('[HomeScreen] deletedTasks.length:', deletedTasks.length);
  }, [showDeletedTasks, deletedTasks.length]);

  const activeIndex = useMemo(() => {
    if (!currentTaskList) return 0;
    const idx = taskLists.findIndex(t => t.id === currentTaskList.id);
    return idx >= 0 ? idx : 0;
  }, [taskLists, currentTaskList]);

  const handleTaskListActiveChange = useCallback((index: number) => {
    if (index < 0 || index >= taskLists.length) return;
    setCurrentTaskList(taskLists[index].id);
  }, [taskLists, setCurrentTaskList]);

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

  // Small helper: ensure network + get token (sign-in if necessary) and provide progress callback
  const performWithToken = async (action: (token: string, progress?: (msg: string) => void) => Promise<void>, progressCb?: (msg: string) => void) => {
    if (!isOnline) {
      setInlineStatus({ type: 'error', text: 'Offline — connect to internet to sync' });
      return;
    }

    try {
      let token = await getAccessToken();
      if (!token) {
        // Prompt sign-in using a modal like experience rather than Alert
        const doSignIn = await new Promise<boolean>((resolve) => {
          // keep UX simple here: use native alert to confirm sign-in
          Alert.alert(
            'Sign In Required',
            'Please sign in with Google to sync your tasks.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sign In', onPress: () => resolve(true) },
            ],
            { cancelable: true }
          );
        });

        if (!doSignIn) return;

        try {
          await signIn();
        } catch (e) {
          setInlineStatus({ type: 'error', text: 'Sign-in failed' });
          return;
        }

        token = await getAccessToken();
      }

      if (!token) {
        setInlineStatus({ type: 'error', text: 'Failed to obtain access token' });
        return;
      }

      await action(token, progressCb);
    } catch (err) {
      console.error('performWithToken error', err);
      setInlineStatus({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  // Sync actions that update the modal/progress UI
  const startDownload = async () => {
    setSyncModalMessages([]);
    setSyncModalError(null);
    setSyncModalVisible(true);
    setSyncModalBusy(true);

    lastSyncActionRef.current = async () => {
      await performWithToken(async (token, progress) => {
        const onProgress = (msg: string) => {
          setSyncModalMessages(prev => [...prev, msg]);
          progress?.(msg);
        };

        try {
          await downloadFromGoogle(token, onProgress);
          const successText = 'Download completed';
          setInlineStatus({ type: 'success', text: successText });
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
          setInlineStatus({ type: 'error', text: 'Download failed' });
          if (Platform.OS === 'android') ToastAndroid.show('Download failed', ToastAndroid.SHORT);
        }
      });
    };

    try {
      await lastSyncActionRef.current?.();
    } finally {
      setSyncModalBusy(false);
      // keep modal open so user can inspect messages; they can close it manually
    }
  };

  const startUpload = async () => {
    setSyncModalMessages([]);
    setSyncModalError(null);
    setSyncModalVisible(true);
    setSyncModalBusy(true);

    lastSyncActionRef.current = async () => {
      await performWithToken(async (token, progress) => {
        const onProgress = (msg: string) => {
          setSyncModalMessages(prev => [...prev, msg]);
          progress?.(msg);
        };

        try {
          await uploadToGoogle(token, onProgress);
          const successText = 'Upload completed';
          setInlineStatus({ type: 'success', text: successText });
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
          setInlineStatus({ type: 'error', text: 'Upload failed' });
          if (Platform.OS === 'android') ToastAndroid.show('Upload failed', ToastAndroid.SHORT);
        }
      });
    };

    try {
      await lastSyncActionRef.current?.();
    } finally {
      setSyncModalBusy(false);
    }
  };

  const startDownloadThenUpload = async () => {
    setSyncModalMessages([]);
    setSyncModalError(null);
    setSyncModalVisible(true);
    setSyncModalBusy(true);

    lastSyncActionRef.current = async () => {
      await performWithToken(async (token, progress) => {
        const onProgress = (msg: string) => {
          setSyncModalMessages(prev => [...prev, msg]);
          progress?.(msg);
        };

        try {
          await downloadFromGoogle(token, onProgress);
          setSyncModalMessages(prev => [...prev, 'Download finished — starting upload...']);
          await uploadToGoogle(token, onProgress);
          const successText = 'Download and upload completed';
          setInlineStatus({ type: 'success', text: successText });
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
          setInlineStatus({ type: 'error', text: 'Sync failed' });
          if (Platform.OS === 'android') ToastAndroid.show('Sync failed', ToastAndroid.SHORT);
        }
      });
    };

    try {
      await lastSyncActionRef.current?.();
    } finally {
      setSyncModalBusy(false);
    }
  };

  const handleSyncOptions = () => {
    // show a modal rather than an Alert; use simple action sheet via Alert for now to choose
    Alert.alert(
      'Sync with Google',
      'Choose an action for this task list:',
      [
        { text: 'Download from Google', onPress: startDownload },
        { text: 'Upload to Google', onPress: startUpload },
        { text: 'Download then Upload', onPress: startDownloadThenUpload },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const openAdd = () => {
    setIsAddingTask(true);
  };

  const closeAdd = () => {
    setIsAddingTask(false);
    Keyboard.dismiss();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSelectionMode) {
        clearSelection();
        return true;
      }
      if (isAddingTask) {
        closeAdd();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [isSelectionMode, clearSelection, isAddingTask]);


  const renderDragListItem = (info: DragListRenderItemInfo<typeof tasks[0]>) => {
    const { item, onDragStart, onDragEnd, isActive } = info;
    const stableIndex = getStableIndex(displayedTasks, item.id);
    const getCardBackgroundColor = (stableIndex: number, totalCount: number): string | undefined => {
      if (themeColor === 'default') return undefined;
      return gradientTheme.getItemColor(stableIndex, totalCount);
    };
    const backgroundColor = getCardBackgroundColor(stableIndex, displayedTasks.length);
    const isFirstInList = displayedTasks[0]?.id === item.id;
    const isLastInList = displayedTasks[displayedTasks.length - 1]?.id === item.id;
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
        showDragHandle={!isSelectionMode}
        onDragStart={isSelectionMode ? undefined : onDragStart}
        onDragEnd={isSelectionMode ? undefined : onDragEnd}
        isActive={isActive}
        selected={selectedTaskIds.includes(item.id)}
        selectionMode={isSelectionMode}
        backgroundColor={backgroundColor}
        isFirstInList={isFirstInList}
        isLastInList={isLastInList}
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
    { label: 'Sort by due date ↑', onPress: () => selectSort('dueDateAsc') },
    { label: 'Sort by creation ↓', onPress: () => selectSort('createdAtDesc') },
    { label: 'Custom sort', onPress: () => selectSort('custom') },
  ];

  const shareTaskList = async () => {
    if (!currentTaskList || displayedTasks.length === 0) {
      Alert.alert('No tasks', 'There are no tasks to share in this list.');
      return;
    }

    let tasksToShare = displayedTasks;
    const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
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

    const shareText = `${currentTaskList.title}\n${taskLines.join('\n')}`;

    try {
      await Share.share({ message: shareText });
    } catch (error) {
      Alert.alert('Sharing failed', 'Unable to share the task list.');
    }
  };

  const footers = useMemo(() => (
    <View>
      <CompletedTasksFooter
        tasks={completedTasks}
        isSelectionMode={isSelectionMode}
        selectedTaskIds={selectedTaskIds}
        onPressTask={(id) => {
          if (isSelectionMode) toggleSelectTask(id);
          else navigation.navigate('EditTask', { taskId: id });
        }}
        onLongPressTask={toggleSelectTask}
        onClearCompleted={() => {
          Alert.alert(
            'Clear completed tasks',
            'Move all completed tasks in this list to deleted?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: () => {
                  completedTasks.forEach((t) => deleteTask(t.id));
                },
              },
            ]
          );
        }}
      />
      {showDeletedTasks && (
        <DeletedTasksFooter
          tasks={deletedTasks}
          isSelectionMode={isSelectionMode}
          selectedTaskIds={selectedTaskIds}
          onPressTask={(id) => {
            if (isSelectionMode) toggleSelectTask(id);
            else navigation.navigate('EditTask', { taskId: id });
          }}
          onLongPressTask={toggleSelectTask}
          onClearAll={() => {
            Alert.alert(
              'Clear deleted tasks',
              'Permanently delete all deleted tasks in this list?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    deletedTasks.forEach((t) => permanentlyDeleteTask(t.id));
                  },
                },
              ]
            );
          }}
        />
      )}
    </View>
  ), [completedTasks, isSelectionMode, selectedTaskIds, toggleSelectTask, navigation, showDeletedTasks, deletedTasks, permanentlyDeleteTask, deleteTask]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Inline status banner */}
      {inlineStatus && (
        <View style={[styles.inlineBanner, inlineStatus.type === 'error' ? styles.bannerError : styles.bannerSuccess]}>
          <Text style={styles.bannerText}>{inlineStatus.text}</Text>
        </View>
      )}

      <View style={{ flex: 1, opacity: syncModalBusy ? 0.5 : 1 }} pointerEvents={syncModalBusy ? 'none' : 'auto'}>
        <View style={{ paddingHorizontal: 16, position: 'relative', zIndex: 10 }}>
          {isSelectionMode ? (
            // ToDo: Extract context bar as component
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
                  onPress={() => { shareTaskList(); }}
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
                            selectedTaskIds.forEach(id => {
                              const task = tasks.find(t => t.id === id);
                              if (task?.isDeleted) {
                                permanentlyDeleteTask(id);
                              } else {
                                deleteTask(id);
                              }
                            });
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
              leftIcon={userInfo?.picture ? { uri: userInfo.picture } : require('../assets/default-profile.png')}
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
              onRightIcon1Press={handleSyncOptions}
              rightIcon2={<Ionicons name="filter" size={20} color={theme.text} />}
              filterMenuItems={filterMenuItems}
              otherMenuItems={[]}
            />
          )}
        </View>

        <HorizontalScrollWithUnderline
          taskLists={taskLists}
          selectedIndex={activeIndex}
          onActiveChange={handleTaskListActiveChange}
          onAddPress={() => setNewListModalVisible(true)}
        />

        {displayedTasks.length === 0 && completedTasks.length === 0 && (!showDeletedTasks || deletedTasks.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
          </View>
        ) : sortOption === 'custom' ? (
          <View style={{ flex: 1, paddingTop: 16 }}>
            <DragList
              data={displayedTasks}
              keyExtractor={(it) => it.id}
              renderItem={renderDragListItem}
              onReordered={onReordered}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={footers}
            />
          </View>
        ) : sortOption === 'dueDateAsc' ? (
          <DueDateSectionList
            tasks={displayedTasks}
            selectedIds={selectedTaskIds}
            selectionMode={isSelectionMode}
            onPress={(id: string) => {
              if (selectedTaskIds.length > 0) {
                toggleSelectTask(id);
                return;
              }
              navigation.navigate('EditTask', { taskId: id });
            }}
            onLongPress={(id: string) => toggleSelectTask(id)}
            ListFooterComponent={footers}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <FlatList
            data={displayedTasks}
            keyExtractor={(item) => item.id}
            extraData={displayedTasks}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const stableIndex = getStableIndex(displayedTasks, item.id);
              const getCardBackgroundColor = (stableIndex: number, totalCount: number): string | undefined => {
                if (themeColor === 'default') return undefined;
                return gradientTheme.getItemColor(stableIndex, totalCount);
              };
              const backgroundColor = getCardBackgroundColor(stableIndex, displayedTasks.length);
              const isFirstInList = index === 0;
              const isLastInList = index === displayedTasks.length - 1;
              return (
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
                  backgroundColor={backgroundColor}
                  isFirstInList={isFirstInList}
                  isLastInList={isLastInList}
                />
              );
            }}
            ListFooterComponent={footers}
          />
        )}

        {/* Floating Add Button opens the CustomBottomDrawer */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={openAdd}
          accessibilityLabel="Add task"
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
        {/* Backdrop for outside tap to close */}
        {isAddingTask && (
          <TouchableWithoutFeedback onPress={() => closeAdd()}>
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.overlay, zIndex: 10 },
              ]}
            />
          </TouchableWithoutFeedback>
        )}

        <AddNewTaskDrawer
          visible={isAddingTask}
          onClose={() => closeAdd()}
          onSubmit={async (title, description, dueDate) => {
            const trimmed = title.trim();
            if (!trimmed) return;

            if (!currentTaskListId) {
              Alert.alert('No list selected', 'Please select a task list first.');
              return;
            }

            try {
              await addTask({
                title: trimmed,
                description: description,
                dueDate: dueDate,
                tasklistId: currentTaskListId,
              });

              closeAdd();
            } catch (err) {
              console.error('Failed adding new task', err);
              Alert.alert('Error', 'Failed to add task.');
            }
          }}
          currentTaskListId={currentTaskListId}
        />

      </View>

      {/* Full-screen Sync Modal */}
      <Modal
        visible={syncModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!syncModalBusy) setSyncModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { marginBottom: 8 }]}>Sync with Google</Text>

            <View style={{ minHeight: 120, maxHeight: 360 }}>
              {syncModalMessages.length === 0 ? (
                <Text style={{ color: theme.text }}>Waiting for progress...</Text>
              ) : (
                syncModalMessages.map((m, idx) => (
                  <Text key={idx} style={{ marginVertical: 4, color: theme.text }}>{m}</Text>
                ))
              )}
            </View>

            {syncModalError && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ color: '#FF3B30', marginBottom: 8 }}>Error: {syncModalError}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              {!syncModalBusy && (
                <Pressable style={styles.modalButton} onPress={() => setSyncModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Close</Text>
                </Pressable>
              )}

              {syncModalBusy && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ marginLeft: 8 }}>Working…</Text>
                </View>
              )}

              {!syncModalBusy && syncModalError && (
                <Pressable
                  style={[styles.modalButton, styles.modalPrimary]}
                  onPress={() => {
                    // retry
                    if (lastSyncActionRef.current) {
                      setSyncModalMessages([]);
                      setSyncModalError(null);
                      setSyncModalBusy(true);
                      lastSyncActionRef.current().finally(() => setSyncModalBusy(false));
                    }
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.modalPrimaryText]}>Retry</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* New Task List Modal */}
      <NewTaskListModal
        visible={newListModalVisible}
        onClose={() => setNewListModalVisible(false)}
        onSubmit={(title) => {
          addTaskList({ title });
          setNewListModalVisible(false);
        }}
      />
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
      height: 64,
      backgroundColor: theme.background,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      fontSize: 14,

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
      fontSize: 14,
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
      paddingTop: 16,
      paddingBottom: SCREEN_HEIGHT * 0.15,
    },
    taskCard: {
      backgroundColor: theme.surface,
      padding: 0,
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
      right: SCREEN_WIDTH * 0.1,
      bottom: SCREEN_HEIGHT * 0.05,
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

    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
    },
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
    modalPrimaryText: { color: theme.text },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      padding: 20,
    },
    handleBar: {
      width: 40,
      height: 5,
      backgroundColor: '#D3D3D3',
      borderRadius: 3,
    },
    bottomHeader: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 6,
      flex: 1,
      alignContent: "center"
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.text
    },

    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.primary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    textArea: {
      height: 80,
      paddingTop: 12,
    },

    inlineBanner: {
      width: '100%',
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    bannerText: { color: '#fff', fontWeight: '600' },
    bannerSuccess: { backgroundColor: '#2ECC71' },
    bannerError: { backgroundColor: '#FF3B30' },

  });