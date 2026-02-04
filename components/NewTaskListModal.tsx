import { useEffect, useRef, useState } from 'react';
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
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface NewTaskListModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

export default function NewTaskListModal({
  visible,
  onClose,
  onSubmit,
}: NewTaskListModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Animated value to lift the card above the keyboard.
  // Positive translateY moves _down_, so we use negative values to lift.
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // tiny delay helps ensure keyboard events come after focus
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setTitle('');
      // reset translateY immediately when modal closes
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  useEffect(() => {
    const onKeyboardShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      const duration = e.duration ?? 250;
      const toValue = -Math.max(0, height)

      Animated.timing(translateY, {
        toValue,
        duration,
        useNativeDriver: true, // transforms support native driver
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
  }, [translateY, insets.bottom]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  };

  const styles = makeStyles(theme, insets);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      backdropColor={theme.overlay}
      avoidKeyboard
      propagateSwipe
      backdropOpacity={0.5}
      useNativeDriver
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={250}
      style={styles.modal} // keep container anchored to bottom
    >
      {/* apply the transform to the card itself so react-native-modal layout stays stable */}
      <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
        <Text style={styles.title}>New Task List</Text>

        <TextInput
          ref={inputRef}
          placeholder="List title"
          placeholderTextColor={theme.muted}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={handleSubmit}
          style={styles.input}
          returnKeyType="done"
        />

        <View style={styles.actions}>
          <Pressable onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>

          <Pressable onPress={handleSubmit} style={[styles.button, styles.primary]}>
            <Text style={[styles.buttonText, styles.primaryText]}>Add</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    modal: {
      margin: 0,
      justifyContent: 'flex-end', // keep modal anchored bottom
    },
    card: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 20 + insets.bottom,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    title: {
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
      backgroundColor: theme.surface,
      color: theme.text,
      fontSize: 16,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    primary: {
      backgroundColor: theme.primary,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    primaryText: {
      color: '#fff',
    },
  });
