import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useTasks } from "../context/TaskContext";


const DEFAULT_AVATAR = require("../assets/default-profile.png");
const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const { theme, scheme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);

  const mockName = "Firstname Lastname";
  const mockEmail = "firstname.lastname@example.com";

  const menuItems: { key: string; label: string; icon: React.ReactNode; onPress: () => void }[] =
    [
      {
        key: "lists",
        label: "My task lists",
        icon: <Ionicons name="list" size={20} color={theme.text} />,
        onPress: () => {
          navigation.closeDrawer();
          navigation.navigate("TaskList" as never);
        },
      },
      {
        key: "profile",
        label: "Profile",
        icon: <Ionicons name="person-circle" size={20} color={theme.text} />,
        onPress: () => Alert.alert("Not implemented", "Profile screen not implemented yet"),
      },
      {
        key: "settings",
        label: "Settings",
        icon: <Ionicons name="settings" size={20} color={theme.text} />,
        onPress: () => Alert.alert("Not implemented", "Settings screen not implemented yet"),
      },
    ];

  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.root}>
      {/* Top section */}
      <View style={styles.topSection}>
        <View style={styles.topRow}>
          <Image source={DEFAULT_AVATAR} style={styles.avatar} />

          <TouchableOpacity
            style={styles.themeToggle}
            onPress={() => toggleTheme()}
            accessibilityLabel="toggle-theme"
          >
            {scheme === "dark" ? (
              <Ionicons name="moon" size={20} color={theme.text} />
            ) : (
              <Ionicons name="sunny" size={20} color={theme.text} />
            )}
          </TouchableOpacity>
        </View>

        {/* User info with dropdown icon */}
        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.name}>{mockName}</Text>
              <Text style={styles.email}>{mockEmail}</Text>
            </View>
            <TouchableOpacity style={{paddingRight: 4}} onPress={() => setShowDropdown(!showDropdown)}>
              {showDropdown ? 
                <Ionicons name="chevron-up" size={20} color={theme.text} /> 
                : <Ionicons name="chevron-down" size={20} color={theme.text} />
              }
            </TouchableOpacity>
          </View>

          {/* Dropdown menu */}
          {showDropdown && (
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowDropdown(false);
                  Alert.alert("Not implemented", "Add account action not implemented yet");
                }}
              >
                <View style={styles.menuIcon}>
                  <MaterialIcons name="person-add" size={20} color={theme.text} />
                </View>
                <Text style={styles.menuLabel}>Add account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Menu section */}
      <View style={styles.menuSection}>
        {menuItems.map((it) => (
          <TouchableOpacity key={it.key} style={styles.menuItem} onPress={it.onPress}>
            <View style={styles.menuIcon}>{it.icon}</View>
            <Text style={styles.menuLabel}>{it.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>App version 1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    topSection: {
      padding: 16,
      backgroundColor: theme.background,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      resizeMode: "cover",
    },
    themeToggle: {
      paddingRight: 4,
      borderRadius: 8,
      backgroundColor: theme.background,
    },
    userInfo: {
      marginTop: 12,
    },
    name: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.text,
    },
    email: {
      fontSize: 13,
      color: theme.muted,
      marginTop: 4,
    },
    dropdownContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.background,
      borderRadius: 8,
    },
    dropdownItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      backgroundColor: theme.background
    },
    menuSection: {
      flex: 1,
      paddingTop: 12,
      paddingHorizontal: 8,
      backgroundColor: theme.surface,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginVertical: 4,
    },
    menuIcon: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    menuLabel: {
      fontSize: 15,
      color: theme.text,
    },
    footer: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerText: {
      fontSize: 12,
      color: theme.muted,
    },
  });