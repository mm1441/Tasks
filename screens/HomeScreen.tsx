import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, Pressable } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from "../context/TaskContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { TopBar } from "../components/TopBar";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../App";


type HomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

type SortOption = 'dueDateAsc' | 'dueDateDesc' | 'createdAtAsc' | 'createdAtDesc' | null;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { tasks, deleteTask } = useTasks();
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>(null);

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Delete Task", `Are you sure you want to delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTask(id) },
    ]);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Compute filtered + sorted list derived from tasks, searchText and sortOption
  const displayedTasks = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let list = tasks.slice(); // copy


    if (q.length > 0) {
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }


    if (sortOption) {
      list.sort((a, b) => {
        if (sortOption === 'dueDateAsc' || sortOption === 'dueDateDesc') {
          const aTs = a.dueDate ? new Date(a.dueDate).getTime() : (sortOption === 'dueDateAsc' ? Infinity : -Infinity);
          const bTs = b.dueDate ? new Date(b.dueDate).getTime() : (sortOption === 'dueDateAsc' ? Infinity : -Infinity);
          return sortOption === 'dueDateAsc' ? aTs - bTs : bTs - aTs;
        }


        // createdAt sorts (createdAt should exist)
        const aC = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bC = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOption === 'createdAtAsc' ? aC - bC : bC - aC;
      });
    }


    return list;
  }, [tasks, searchText, sortOption]);


  const onSearchIconPress = () => {
    setSearchVisible((v) => {
      const next = !v;
      if (!next) setSearchText(''); // clear when closing search
      return next;
    });
  };


  const onFilterIconPress = () => {
    setSortModalVisible(true);
  };


  const selectSort = (option: SortOption) => {
    setSortOption(option);
    setSortModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopBar
        title={searchVisible ? '' : 'My Tasks'}
        icon1={<Ionicons name="search" size={20} />}
        icon2={<Ionicons name="filter" size={20} />}
        onIcon1Press={onSearchIconPress}
        onIcon2Press={onFilterIconPress}
      />

      {searchVisible && (
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search tasks by title..."
            value={searchText}
            onChangeText={setSearchText}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => { setSearchText(''); setSearchVisible(false); }} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}


      {displayedTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tasks yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
        </View>
      ) : (
        <FlatList
          data={displayedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
                style={styles.taskCard}
                onPress={() => navigation.navigate("EditTask", { taskId: item.id })}
                onLongPress={() => handleDelete(item.id, item.title)}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              {item.description && <Text style={styles.taskDescription}>{item.description}</Text>}
              {item.dueDate && <Text style={styles.taskDueDate}>Due: {formatDate(item.dueDate)}</Text>}
            </TouchableOpacity>
          )}
        />
      )}


      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddTask')}
        accessibilityLabel="Add task"
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>


      {/* Sort Modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort tasks</Text>
            <Pressable style={styles.modalButton} onPress={() => selectSort('dueDateAsc')}>
              <Text>Due Date (ascending)</Text>
            </Pressable>
            <Pressable style={styles.modalButton} onPress={() => selectSort('dueDateDesc')}>
              <Text>Due Date (descending)</Text>
            </Pressable>
            <Pressable style={styles.modalButton} onPress={() => selectSort('createdAtAsc')}>
              <Text>Creation Date (ascending)</Text>
            </Pressable>
            <Pressable style={styles.modalButton} onPress={() => selectSort('createdAtDesc')}>
              <Text>Creation Date (descending)</Text>
            </Pressable>
            <Pressable style={styles.modalButton} onPress={() => selectSort(null)}>
              <Text style={{ fontWeight: '600' }}>Clear sort</Text>
            </Pressable>


            <Pressable style={[styles.modalButton, styles.modalClose]} onPress={() => setSortModalVisible(false)}>
              <Text>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    padding: 16,
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
    right: 36, // ToDo: Take screen width and move for %
    bottom: 36, // ToDo: Take screen height and move for %
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalClose: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
});