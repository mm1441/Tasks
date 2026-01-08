import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

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

const styles = StyleSheet.create({
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