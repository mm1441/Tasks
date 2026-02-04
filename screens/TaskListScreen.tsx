// TaskListsScreen.jsx
import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Pressable,
  Platform,
  Alert,
  Share,
  Dimensions,
  ActivityIndicator,
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../components/TopBar';
import { useTasks } from '../context/TaskContext';
import { useTheme } from '../context/ThemeContext';
import { useGoogleAuth } from '../context/GoogleAuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NewTaskListModal from '../components/NewTaskListModal';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TaskListsScreen({ navigation }) {
  const {
    tasks,
    taskLists,
    currentTaskList,
    currentTaskListId,
    addTaskList,
    setCurrentTaskList,
    updateTaskList,
    deleteTaskList,
    deleteTask,
    downloadFromGoogle,
    uploadToGoogle,
  } = useTasks();
  const { theme } = useTheme();
  const { getAccessToken, signIn } = useGoogleAuth();
  const { isOnline } = useNetworkStatus();
  const styles = makeStyles(theme);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Sync modal state (same as HomeScreen)
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncModalMessages, setSyncModalMessages] = useState<string[]>([]);
  const [syncModalError, setSyncModalError] = useState<string | null>(null);
  const [syncModalBusy, setSyncModalBusy] = useState(false);
  const lastSyncActionRef = useRef<(() => Promise<void>) | null>(null);


  const displayedTaskLists = useMemo(() => {
    if (!taskLists) return [];
    return taskLists.map(list => ({
      ...list,
      tasksCount: tasks.filter(t => t.tasklistId === list.id).length,
    }));
  }, [taskLists, tasks]);

  const [modalVisible, setModalVisible] = useState(false);
  const listRef = useRef(null);

  const handleAddPress = () => setModalVisible(true);

  const handleAddList = (title: string) => {
    addTaskList({ title });
    // scroll to end so the new item is visible (since context appends)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const performWithToken = async (action: (token: string, progress?: (msg: string) => void) => Promise<void>) => {
    if (!isOnline) {
      Alert.alert('Offline', 'Connect to internet to sync.');
      return;
    }
    try {
      let token = await getAccessToken();
      if (!token) {
        const doSignIn = await new Promise<boolean>((resolve) => {
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
        } catch {
          Alert.alert('Error', 'Sign-in failed');
          return;
        }
        token = await getAccessToken();
      }
      if (!token) {
        Alert.alert('Error', 'Failed to obtain access token');
        return;
      }
      await action(token);
    } catch (err) {
      console.error('performWithToken error', err);
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  };

  const startDownload = async () => {
    setSyncModalMessages([]);
    setSyncModalError(null);
    setSyncModalVisible(true);
    setSyncModalBusy(true);
    lastSyncActionRef.current = async () => {
      await performWithToken(async (token) => {
        const onProgress = (msg: string) => setSyncModalMessages((prev) => [...prev, msg]);
        try {
          await downloadFromGoogle(token, onProgress);
          const successText = 'Download completed';
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
          if (Platform.OS === 'android') ToastAndroid.show('Download failed', ToastAndroid.SHORT);
        }
      });
    };
    try {
      await lastSyncActionRef.current?.();
    } finally {
      setSyncModalBusy(false);
    }
  };

  const startUpload = async () => {
    setSyncModalMessages([]);
    setSyncModalError(null);
    setSyncModalVisible(true);
    setSyncModalBusy(true);
    lastSyncActionRef.current = async () => {
      await performWithToken(async (token) => {
        const onProgress = (msg: string) => setSyncModalMessages((prev) => [...prev, msg]);
        try {
          await uploadToGoogle(token, onProgress);
          const successText = 'Upload completed';
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
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
      await performWithToken(async (token) => {
        const onProgress = (msg: string) => setSyncModalMessages((prev) => [...prev, msg]);
        try {
          await downloadFromGoogle(token, onProgress);
          setSyncModalMessages((prev) => [...prev, 'Download finished — starting upload...']);
          await uploadToGoogle(token, onProgress);
          const successText = 'Download and upload completed';
          if (Platform.OS === 'android') ToastAndroid.show(successText, ToastAndroid.SHORT);
        } catch (e) {
          const errText = e instanceof Error ? e.message : String(e);
          setSyncModalError(errText);
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

  const shareTaskList = async () => {
    const list = taskLists.find(l => l.id === selectedListId);
    if (!list) return;

    const listTasks = tasks.filter(t => t.tasklistId === list.id);
    if (listTasks.length === 0) {
      Alert.alert('Empty list', 'There are no tasks to share.');
      return;
    }

    const taskLines = listTasks.map(task => {
      let line = `• ${task.title}`;
      if (task.description) line += ` - ${task.description}`;
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const formattedDate = dueDate.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });
        line += ` (Due: ${formattedDate})`;
      }
      return line;
    });

    const shareText = `${list.title}\n\n${taskLines.join('\n')}`;

    try {
      await Share.share({ message: shareText });
    } catch (err) {
      // user cancelled or an error occurred; optionally show alert
      console.debug('Share cancelled/failed', err);
    } finally {
      // close modal after share attempt
      setSelectedListId(null);
    }
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        setCurrentTaskList(item.id);
        if (navigation?.navigate) navigation.navigate('Root', { screen: 'Home' });
      }}
      onLongPress={() => {
        setSelectedListId(item.id);
        setRenameTitle(item.title);
      }}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>{item.tasksCount} tasks</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.text} />
    </TouchableOpacity>
  );

  const keyExtractor = (item) => item.id;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={theme.name === 'dark' ? 'light-content' : 'dark-content'} />
      <TopBar
        title="Task Lists"
        leftIcon={<Ionicons name="chevron-back" size={26} color={theme.text} />}
        onLeftIconPress={() => (navigation?.goBack ? navigation.goBack() : null)}
        rightIcon1={<Ionicons name="sync" size={24} color={theme.name === 'dark' ? '#FFF' : theme.primary} />}
        onRightIcon1Press={handleSyncOptions}
      />

      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={displayedTaskLists}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[displayedTaskLists.length === 0 ? styles.emptyContainer : styles.listContent]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptySubtitle}>Create a list using the + button</Text>
            </View>
          }
        />

        {/* Floating Action Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.fab}
          onPress={handleAddPress}
          accessibilityLabel="Add task list"
        >
          <Ionicons name="add" size={28} color={"#FFF"} />
        </TouchableOpacity>

        {/* Add modal */}
        <NewTaskListModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSubmit={handleAddList}
        />

        {/* Full-screen Sync Modal (same as HomeScreen) */}
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
                    <Text style={{ marginLeft: 8, color: theme.text }}>Working…</Text>
                  </View>
                )}

                {!syncModalBusy && syncModalError && (
                  <Pressable
                    style={[styles.modalButton, styles.modalPrimary]}
                    onPress={() => {
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

        {selectedListId && (
          <Modal
            transparent
            visible
            animationType="fade"
            onRequestClose={() => setSelectedListId(null)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setSelectedListId(null)}
            >
              <View style={styles.actionSheet} onStartShouldSetResponder={() => true}>
                <View style={styles.renameRow}>
                  <TextInput
                    value={renameTitle}
                    onChangeText={setRenameTitle}
                    style={styles.renameInput}
                    placeholder="List name"
                    autoFocus
                  />
                  <Pressable
                    onPress={() => {
                      const trimmed = renameTitle.trim();
                      if (!trimmed) return;

                      const list = taskLists.find(tl => tl.id === selectedListId);
                      if (!list) return;

                      const isUnchanged = list?.title === renameTitle.trim();
                      if (!trimmed || isUnchanged) return;

                      updateTaskList({
                        ...list,
                        title: trimmed,
                      });

                      setSelectedListId(null);
                    }}
                  >
                    <Text style={styles.renameSave}>Save</Text>
                  </Pressable>
                </View>

                {/* Share */}
                <TouchableOpacity
                  style={styles.actionButton}
                  // inside your Modal action sheet — replace the Share TouchableOpacity onPress
                  onPress={shareTaskList}

                >
                  <Ionicons name="share-outline" size={22} color={theme.text} />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete list',
                      'This will delete the list and all its tasks.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            deleteTaskList(selectedListId);
                            setSelectedListId(null);
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                  <Text style={[styles.actionText, { color: '#FF3B30' }]}>
                    Delete
                  </Text>
                </TouchableOpacity>

              </View>
            </Pressable>
          </Modal>
        )}

      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    safe: { 
      flex: 1, 
      backgroundColor: theme.background,
    },
    container: { 
      flex: 1,
      padding: 16,
    },
    listContent: {
      paddingBottom: SCREEN_HEIGHT * 0.15,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.surface,
    },
    rowContent: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    rowSubtitle: { marginTop: 4, color: theme.muted },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: 16 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 6, color: theme.text },
    emptySubtitle: { color: theme.muted },

    fab: {
      position: 'absolute',
      right: SCREEN_WIDTH * 0.1,
      bottom: SCREEN_HEIGHT * 0.05,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      color: "#ffffff",
      justifyContent: 'center',
      alignItems: 'center',
      // shadow
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 8 },
        android: { elevation: 6 },
      }),
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      padding: 20,
      color: theme.primary,
    },

    actionSheet: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
    },

    renameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },

    renameInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      color: theme.text,
    },

    renameSave: {
      marginLeft: 12,
      color: theme.primary,
      fontWeight: '600',
    },

    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },

    actionText: {
      marginLeft: 12,
      fontSize: 16,
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
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.text,
    },
    modalButton: { paddingVertical: 8, paddingHorizontal: 12 },
    modalPrimary: { backgroundColor: theme.primary, borderRadius: 8, marginLeft: 8 },
    modalButtonText: { color: theme.text, fontWeight: '600' },
    modalPrimaryText: { color: theme.text },

  });