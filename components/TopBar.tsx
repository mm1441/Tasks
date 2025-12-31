import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type TopBarProps = {
  title: string;
  icon1: React.ReactNode;
  icon2?: React.ReactNode;
  onIcon1Press?: () => void;
  onIcon2Press?: () => void;
};

export const TopBar: React.FC<TopBarProps> = ({ title, icon1, icon2, onIcon1Press, onIcon2Press }) => {
  return (
    <View style={styles.container}>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={styles.iconRow}>
        <TouchableOpacity onPress={onIcon1Press} style={styles.iconButton} accessibilityLabel="icon1">
          {icon1}
        </TouchableOpacity>
        {icon2 && (
          <TouchableOpacity onPress={onIcon2Press} style={styles.iconButton} accessibilityLabel="icon2">
            {icon2}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
  },
});