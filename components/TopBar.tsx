import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
  ImageSourcePropType,
  GestureResponderEvent,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';


type TopBarMenuItem = {
  label: string;
  onPress: () => void;
};

type IconProp = ImageSourcePropType | React.ReactNode;

type TopBarProps = {
  title?: string;
  leftIcon?: IconProp;
  onLeftIconPress?: (e?: GestureResponderEvent) => void;
  rightIcon1?: IconProp;
  onRightIcon1Press?: (e?: GestureResponderEvent) => void;
  rightIcon2?: IconProp;
  onRightIcon2Press?: (e?: GestureResponderEvent) => void;
  rightIcon3?: IconProp;
  onRightIcon3Press?: (e?: GestureResponderEvent) => void;
  filterMenuItems?: TopBarMenuItem[];
  otherMenuItems?: TopBarMenuItem[];
};

export const TopBar: React.FC<TopBarProps> = ({
  title,
  leftIcon,
  onLeftIconPress,
  rightIcon1,
  onRightIcon1Press,
  rightIcon2,
  onRightIcon2Press,
  rightIcon3,
  onRightIcon3Press,
  filterMenuItems = [],
  otherMenuItems = [],
}) => {
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [otherMenuVisible, setOtherMenuVisible] = useState(false);
  const { theme } = useTheme();

  const styles = makeStyles(theme);

  const renderIcon = (icon?: IconProp, opts?: { left?: boolean }) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    return <Image source={icon as ImageSourcePropType} style={opts?.left ? styles.leftImage : styles.iconImage} resizeMode="cover" />;
  };

  return (
    <View style={[styles.container]}>
      <View style={styles.leftArea}>
        <TouchableOpacity
          onPress={onLeftIconPress}
          style={styles.iconButton}
          disabled={!leftIcon}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {renderIcon(leftIcon, { left: true })}
        </TouchableOpacity>
      </View>

      <View pointerEvents="none" style={styles.centerArea}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
          {title}
        </Text>
      </View>

      <View style={styles.rightArea}>
        {rightIcon1 && (
          <TouchableOpacity onPress={onRightIcon1Press} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {renderIcon(rightIcon1)}
          </TouchableOpacity>
        )}

        {rightIcon2 && (
          <TouchableOpacity
            onPress={(e) => {
              setFilterMenuVisible((v) => !v);
              onRightIcon2Press?.(e);
            }}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {renderIcon(rightIcon2)}
          </TouchableOpacity>
        )}

        {rightIcon3 && (
          <TouchableOpacity
            onPress={(e) => {
              setOtherMenuVisible((v) => !v);
              onRightIcon3Press?.(e);
            }}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {renderIcon(rightIcon3)}
          </TouchableOpacity>
        )}
      </View>

      {/* filter menu */}
      {filterMenuVisible && filterMenuItems.length > 0 && (
        <Modal
          visible={filterMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFilterMenuVisible(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setFilterMenuVisible(false)}
          >
            <View style={styles.menu}>
              {filterMenuItems.map((item, index) => (
                <Pressable
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    setFilterMenuVisible(false);
                    item.onPress();
                  }}
                >
                  <Text style={styles.menuText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* other menu */}
      {otherMenuVisible && otherMenuItems.length > 0 && (
        <Modal
          visible={otherMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setOtherMenuVisible(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setOtherMenuVisible(false)}
          >
            <View style={styles.menu}>
              {otherMenuItems.map((item, index) => (
                <Pressable
                  key={index}
                  style={styles.menuItem}
                  onPress={() => {
                    setOtherMenuVisible(false);
                    item.onPress();
                  }}
                >
                  <Text style={styles.menuText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const SIDE_WIDTH = 72;

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      height: 64,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      justifyContent: 'center',
      zIndex: 10,
    },

    leftArea: {
      position: 'absolute',
      left: 0,
      width: SIDE_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: 8,
    },

    rightArea: {
      position: 'absolute',
      right: 0,
      width: SIDE_WIDTH,
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 8,
    },

    centerArea: {
      position: 'absolute',
      left: SIDE_WIDTH,
      right: SIDE_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
    },

    title: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      maxWidth: '100%',
    },

    leftImage: {
      width: 38,
      height: 38,
      borderRadius: 19,
    },

    iconImage: {
      width: 22,
      height: 22,
      borderRadius: 4,
    },

    iconButton: {
      padding: 8,
      borderRadius: 8,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    menu: {
      position: 'absolute',
      top: 64,
      right: 8,
      backgroundColor: theme.surface,
      borderRadius: 8,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    menuItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    menuText: {
      fontSize: 16,
      color: theme.text,
    },
  });
export default TopBar;