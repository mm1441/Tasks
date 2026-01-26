import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface NewTaskListModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

export default function NewTaskListModal({ visible, onClose, onSubmit }: NewTaskListModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      
      // Auto-focus the input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      slideAnim.setValue(0);
      setTitle('');
      setKeyboardHeight(0);
      Keyboard.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setTitle('');
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    onClose();
  };

  const styles = makeStyles(theme);

  // Calculate bottom position: when keyboard is open, position above keyboard, otherwise at bottom with safe area
  const bottomPosition = keyboardHeight > 0 ? keyboardHeight : insets.bottom;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable 
          onStartShouldSetResponder={() => true} 
          style={[
            styles.modalContainer,
            {
              bottom: bottomPosition,
            }
          ]}
        >
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.modalTitle}>New Task List</Text>

            <TextInput
              ref={inputRef}
              placeholder="List title"
              placeholderTextColor={theme.muted}
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              onSubmitEditing={handleSubmit}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={handleCancel}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalPrimary]}
                onPress={handleSubmit}
              >
                <Text style={[styles.modalButtonText, styles.modalPrimaryText]}>Add</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.overlay || 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      width: '100%',
      position: 'absolute',
      left: 0,
      right: 0,
    },
    modalCard: {
      width: '100%',
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      marginBottom: 16,
      color: theme.text,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 16,
      backgroundColor: theme.background,
      color: theme.text,
      fontSize: 16,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    modalButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    modalPrimary: {
      backgroundColor: theme.primary,
      marginLeft: 8,
    },
    modalButtonText: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 16,
    },
    modalPrimaryText: {
      color: '#fff',
    },
  });
