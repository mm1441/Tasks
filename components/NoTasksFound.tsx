import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type NoTasksFoundProps = {
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  subtextStyle?: TextStyle;
};

const NoTasksFound: React.FC<NoTasksFoundProps> = ({
  containerStyle,
  textStyle,
  subtextStyle,
}) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.emptyContainer, containerStyle]}>
      <Text style={[styles.emptyText, textStyle]}>No tasks yet</Text>
      <Text style={[styles.emptySubtext, subtextStyle]}>
        Tap + to add your first task
      </Text>
    </View>
  );
};

export default NoTasksFound;

const makeStyles = (theme: any) =>
  StyleSheet.create({
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
  });

// const styles = StyleSheet.create({
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 24,
//   },
//   emptyText: {
//     fontSize: 18,
//     fontWeight: '600',
//     marginBottom: 6,
//   },
//   emptySubtext: {
//     fontSize: 14,
//     color: '#6b7280',
//     textAlign: 'center',
//   },
// });