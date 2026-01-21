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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../components/TopBar';
import { useTasks } from '../context/TaskContext';
import { useTheme } from '../context/ThemeContext';


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
    deleteTask
  } = useTasks();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');


  const displayedTaskLists = useMemo(() => {
    if (!taskLists) return [];
    return taskLists.map(list => ({
      ...list,
      tasksCount: tasks.filter(t => t.tasklistId === list.id).length,
    }));
  }, [taskLists, tasks]);

  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const listRef = useRef(null);

  const handleAddPress = () => setModalVisible(true);

  const addList = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return; // simple validation
    addTaskList({ title: trimmed });
    setNewTitle('');
    setModalVisible(false);
    // scroll to end so the new item is visible (since context appends)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
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
        rightIcon1={<Ionicons name="search" size={24} color={theme.text} />}
        onRightIcon1Press={() => {
          // hook up search UI
          console.log('search pressed');
        }}
        rightIcon2={<Ionicons name="filter" size={24} color={theme.text}/>}
        onRightIcon2Press={() => {
          // hook up filter UI
          console.log('filter pressed');
        }}
      />

      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={displayedTaskLists}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={displayedTaskLists.length === 0 ? styles.emptyContainer : undefined}
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
          <Ionicons name="add" size={28} color={theme.text} />
        </TouchableOpacity>

        {/* Add modal */}
        <Modal
          animationType="slide"
          transparent visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Task List</Text>

              <TextInput
                placeholder="List title"
                value={newTitle}
                onChangeText={setNewTitle}
                style={styles.input}
                autoFocus
              />

              <View style={styles.modalActions}>
                <Pressable style={styles.modalButton} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalButton, styles.modalPrimary]} onPress={addList}>
                  <Text style={[styles.modalButtonText, styles.modalPrimaryText]}>Add</Text>
                </Pressable>
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
    safe: { flex: 1, backgroundColor: theme.background },

    container: { flex: 1 },

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
      right: 20,
      bottom: 28,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      // shadow
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 8 },
        android: { elevation: 6 },
      }),
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

  });