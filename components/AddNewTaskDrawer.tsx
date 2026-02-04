import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Keyboard,
  KeyboardEvent,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '../context/ThemeContext';

interface AddNewTaskDrawerProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, description?: string, dueDate?: string) => Promise<void>;
  currentTaskListId: string | null;
}

export default function AddNewTaskDrawer({
  visible,
  onClose,
  onSubmit,
  currentTaskListId,
}: AddNewTaskDrawerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDescriptionInput, setShowDescriptionInput] = useState(false);

  const translateY = useRef(new Animated.Value(0)).current;
  const titleInputRef = useRef<TextInput | null>(null);
  const descriptionInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    } else {
      Keyboard.dismiss();
      setTitle('');
      setDescription('');
      setDueDate('');
      setShowDescriptionInput(false);
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const isSaveDisabled = !title.trim();

  useEffect(() => {
    const onKeyboardShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      const duration = e.duration ?? 250;
      const toValue = -Math.max(0, height);

      Animated.timing(translateY, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    };

    const onKeyboardHide = (e?: KeyboardEvent) => {
      const duration = e?.duration ?? 200;
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }).start();
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [translateY]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    if (!currentTaskListId) {
      return;
    }

    try {
      await onSubmit(trimmed, description.trim() || undefined, dueDate.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Failed adding new task', err);
    }
  };

  const handleDateConfirm = (selectedDate: Date) => {
    setShowDatePicker(false);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
    setDueDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  if (!visible) return null;

  const styles = makeStyles(theme);

  const formatDueDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 11,
            backgroundColor: theme.background,
            borderTopLeftRadius: 25,
            borderTopRightRadius: 25,
            overflow: 'hidden',
            transform: [{ translateY }],
          },
        ]}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom,
          }}
        >
          <View style={styles.header}>
            <Text style={styles.modalTitle}>New Task</Text>
          </View>

          <TextInput
            ref={titleInputRef}
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={theme.muted}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {showDescriptionInput && (
            <View style={styles.descriptionContainer}>
              <TextInput
                ref={descriptionInputRef}
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Add description..."
                placeholderTextColor={theme.muted}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Action Icons Row */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.iconButton}
              onPress={() => {
                setShowDescriptionInput(!showDescriptionInput);
                if (!showDescriptionInput) {
                  setTimeout(() => descriptionInputRef.current?.focus(), 100);
                }
              }}
            >
              <Ionicons
                name={showDescriptionInput ? 'document-text' : 'document-text-outline'}
                size={20}
                color={showDescriptionInput ? theme.primary : theme.muted}
              />
            </Pressable>

            <View style={[styles.iconButton, dueDate && styles.iconButtonExpanded]}>
              <Pressable
                style={styles.iconButtonContent}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons
                  name={dueDate ? 'calendar' : 'calendar-outline'}
                  size={20}
                  color={dueDate ? theme.primary : theme.muted}
                />
                {dueDate ? (
                  <Text style={[styles.iconLabel, { color: theme.primary }]} numberOfLines={1}>
                    {formatDueDate(dueDate)}
                  </Text>
                ) : null}
              </Pressable>
              {dueDate && (
                <Pressable
                  onPress={() => setDueDate('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={18} color={theme.primary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <Pressable style={styles.modalButton} onPress={onClose}>
              <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
          
            <Pressable
              style={[
                styles.modalButton,
                {
                  marginLeft: 8,
                  backgroundColor: isSaveDisabled ? theme.muted : theme.primary,
                  opacity: isSaveDisabled ? 0.6 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={isSaveDisabled}
            >
              <Text
                style={[
                  styles.modalButtonText,
                  isSaveDisabled && { opacity: 0.9 },
                ]}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="datetime"
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
        date={dueDate ? new Date(dueDate) : new Date()}
      />
    </>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      marginBottom: 12,
      flex: 1
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    titleInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 16,
      marginBottom: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    iconButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 6,
      minWidth: 44,
    },
    iconButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    iconButtonExpanded: {
      flex: 1,
    },
    clearButton: {
      marginLeft: 4,
    },
    iconLabel: {
      fontSize: 14,
      color: theme.muted,
      flex: 1,
    },
    descriptionContainer: {
      marginBottom: 12,
      
    },
    descriptionInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      color: theme.text,
      fontSize: 14,
      minHeight: 80,
      maxHeight: 120,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
    },
    modalButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    modalButtonText: {
      color: theme.background,
      fontWeight: '600',
      fontSize: 16,
  
    },
  });
