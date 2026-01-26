import { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Share,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useTasks } from "../context/TaskContext";
import { useGoogleAuth } from "../context/GoogleAuthContext";


const DEFAULT_AVATAR = require("../assets/default-profile.png");
const { width } = Dimensions.get('window');
const { height } = Dimensions.get('window');

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { navigation } = props;
  const { theme, scheme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const { 
    tasks, 
    currentTaskList, 
    showDeletedTasks, 
    setShowDeletedTasks 
  } = useTasks();
  const { isAuthenticated, signIn, signOut, userInfo } = useGoogleAuth();

  // Use real user data when authenticated, otherwise use defaults
  const displayName = userInfo?.name || "Firstname Lastname";
  const displayEmail = userInfo?.email || "firstname.lastname@example.com";
  const profilePicture = userInfo?.picture ? { uri: userInfo.picture } : DEFAULT_AVATAR;

  const styles = makeStyles(theme);

  const shareTaskList = async () => {
    // Close drawer first
    navigation.closeDrawer();
    
    // Wait for drawer closing animation and interactions to complete
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        // Additional small delay to ensure drawer is fully closed
        setTimeout(resolve, 200);
      });
    });

    if (!currentTaskList) {
      Alert.alert('No task list', 'Please select a task list first.');
      return;
    }

    const listTasks = tasks.filter(t => 
      t.tasklistId === currentTaskList.id && 
      !t.isDeleted && 
      !t.isCompleted
    );

    if (listTasks.length === 0) {
      Alert.alert('No tasks', 'There are no tasks to share in this list.');
      return;
    }

    const taskLines = listTasks.map(task => {
      let line = `• ${task.title}`;

      if (task.description) {
        line += ` - ${task.description}`;
      }

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const formattedDate = dueDate.toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });
        line += ` (Due: ${formattedDate})`;
      }

      return line;
    });

    const shareText = `${currentTaskList.title}\n${taskLines.join('\n')}`;

    try {
      await Share.share({ message: shareText });
    } catch (error) {
      // Share was cancelled or failed - this is expected behavior, no need to alert
      // The error is typically just the user cancelling the share dialog
    }
  };

  const handleToggleShowDeletedTasks = () => {
    console.log('[CustomDrawer] Toggling showDeletedTasks, current value:', showDeletedTasks);
    setShowDeletedTasks(prev => {
      const newValue = !prev;
      console.log('[CustomDrawer] showDeletedTasks changed to:', newValue);
      return newValue;
    });
  };

  const handleLoginLogout = async () => {
    navigation.closeDrawer();
    if (isAuthenticated) {
      Alert.alert(
        "Log Out",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Log Out",
            style: "destructive",
            onPress: async () => {
              try {
                await signOut();
              } catch (error) {
                Alert.alert("Error", "Failed to log out. Please try again.");
              }
            },
          },
        ]
      );
    } else {
      try {
        await signIn();
      } catch (error) {
        Alert.alert("Error", "Failed to sign in. Please try again.");
      }
    }
  };

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
        key: "share",
        label: "Share task list",
        icon: <Ionicons name="share-outline" size={20} color={theme.text} />,
        onPress: () => {
          shareTaskList();
        },
      },
      {
        key: "toggleDeleted",
        label: showDeletedTasks ? "Hide deleted tasks" : "Show deleted tasks",
        icon: <Ionicons name={showDeletedTasks ? "eye-off-outline" : "eye-outline"} size={20} color={theme.text} />,
        onPress: () => {
          navigation.closeDrawer();
          handleToggleShowDeletedTasks();
        },
      },
      // {
      //   key: "profile",
      //   label: "Profile",
      //   icon: <Ionicons name="person-circle" size={20} color={theme.text} />,
      //   onPress: () => Alert.alert("Not implemented", "Profile screen not implemented yet"),
      // },
      // {
      //   key: "settings",
      //   label: "Settings",
      //   icon: <Ionicons name="settings" size={20} color={theme.text} />,
      //   onPress: () => Alert.alert("Not implemented", "Settings screen not implemented yet"),
      // },
    ];

  return (
    <SafeAreaView style={styles.root}>
      {/* Top section */}
      <View style={styles.topSection}>
        <View style={styles.topRow}>
          <Image source={profilePicture} style={styles.avatar} />

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
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{displayEmail}</Text>
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
        <TouchableOpacity 
          style={styles.loginLogoutButton}
          onPress={handleLoginLogout}
        >
          <Ionicons 
            name={isAuthenticated ? "log-out-outline" : "log-in-outline"} 
            size={20} 
            color={theme.text} 
          />
          <Text style={styles.loginLogoutText}>
            {isAuthenticated ? "Log Out" : "Log In"}
          </Text>
        </TouchableOpacity>
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
    loginLogoutButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: theme.background,
    },
    loginLogoutText: {
      fontSize: 15,
      color: theme.text,
      marginLeft: 12,
    },
    footerText: {
      fontSize: 12,
      color: theme.muted,
    },
  });