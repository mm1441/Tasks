import { useEffect, useRef, useCallback } from "react";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TaskProvider } from "./context/TaskContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { GoogleAuthProvider } from "./context/GoogleAuthContext";
import { DefaultTheme as NavDefault, DarkTheme as NavDark } from "@react-navigation/native";
import AddTaskScreen from "./screens/NewTaskScreen";
import EditTaskScreen from "./screens/EditTaskScreen";
import AppDrawer from "./navigation/AppDrawer";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import TaskListScreen from "./screens/TaskListScreen";
import { Linking } from "react-native";


export type RootStackParamList = {
  Root: undefined;
  Home: undefined;
  AddTask: { taskListId?: string; title?: string; description?: string; dueDate?: string; autoSave?: boolean };
  EditTask: { taskId: string };
  TaskList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function NavigationInner() {
  // safe to call useTheme because NavigationInner is rendered *inside* ThemeProvider
  const { theme, scheme } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  
  // Store pending navigation to execute once navigation is ready
  const pendingNavigationRef = useRef<{ screen: string; params: any } | null>(null);
  
  // Track if we've processed the initial URL (only process once on app startup)
  const initialUrlProcessedRef = useRef(false);

  const navTheme = {
    ...(scheme === "dark" ? NavDark : NavDefault),
    colors: {
      ...(scheme === "dark" ? NavDark.colors : NavDefault.colors),
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  // Execute pending navigation once navigation is ready
  useEffect(() => {
    const checkAndExecutePending = () => {
      if (pendingNavigationRef.current && navigationRef.isReady()) {
        const { screen, params } = pendingNavigationRef.current;
        console.log(`[App] Executing pending navigation to ${screen}`, params);
        
        // If navigating to EditTask and it's already on stack, go back first
        if (screen === "EditTask") {
          const state = navigationRef.getState();
          const editTaskIndex = state?.routes.findIndex(r => r.name === "EditTask");
          if (editTaskIndex !== undefined && editTaskIndex >= 0) {
            navigationRef.goBack();
            setTimeout(() => {
              navigationRef.navigate(screen as any, params);
            }, 100);
          } else {
            navigationRef.navigate(screen as any, params);
          }
        } else {
          navigationRef.navigate(screen as any, params);
        }
        pendingNavigationRef.current = null;
      }
    };
    
    // Check immediately
    checkAndExecutePending();
    
    // Also check periodically until pending is cleared
    const interval = setInterval(() => {
      checkAndExecutePending();
      if (!pendingNavigationRef.current) {
        clearInterval(interval);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [navigationRef]);
  
  // Handle deep links from widget
  useEffect(() => {
    const handleDeepLink = (url: string, retryCount = 0) => {
      console.log("[App] ========== Deep Link Handler Called ==========");
      console.log("[App] Full URL received:", url);
      console.log("[App] Retry count:", retryCount);
      
      // Filter out Expo dev client URLs
      if (url.includes("expo-development-client") || url.includes("exp+tasks://expo")) {
        console.log("[App] Ignoring Expo dev client URL");
        return;
      }

      // Only process our app's deep links
      if (!url.includes("com.magicmarinac.tasks://")) {
        console.log("[App] Ignoring non-widget deep link:", url);
        return;
      }

      console.log("[App] ✓ Valid deep link detected:", url);
      console.log("[App] Checking if navigation is ready...");

      // Maximum 5 retries (1 second total)
      if (!navigationRef.isReady()) {
        if (retryCount < 5) {
          console.log("[App] ⏳ Navigation not ready yet, waiting... (retry", retryCount + 1, ")");
          setTimeout(() => handleDeepLink(url, retryCount + 1), 200);
          return;
        } else {
          console.log("[App] ❌ Navigation not ready after retries, giving up");
          return;
        }
      }

      console.log("[App] ✓ Navigation is ready, processing deep link...");

      if (url.includes("editTask")) {
        console.log("[App] → Processing editTask deep link");
        const taskIdMatch = url.match(/taskId=([^&]+)/);
        console.log("[App] TaskId regex match result:", taskIdMatch);
        
        if (taskIdMatch && taskIdMatch[1]) {
          const taskId = taskIdMatch[1];
          console.log("[App] ✓ TaskId extracted:", taskId);
          console.log("[App] → Navigating to EditTask screen with taskId:", taskId);
          
          try {
            // Navigate immediately if ready, otherwise store for later
            if (navigationRef.isReady()) {
              console.log("[App] Navigation is ready, executing navigate...");
              // Check if EditTask is already on the stack - if so, go back first then navigate
              const state = navigationRef.getState();
              const editTaskIndex = state?.routes.findIndex(r => r.name === "EditTask");
              
              if (editTaskIndex !== undefined && editTaskIndex >= 0) {
                console.log("[App] EditTask already on stack at index", editTaskIndex, "- going back first");
                // Go back to remove the existing EditTask screen
                navigationRef.goBack();
                // Then navigate to the new task after a brief delay
                setTimeout(() => {
                  navigationRef.navigate("EditTask", { taskId });
                  console.log("[App] ✓ Navigated to new EditTask after going back");
                }, 100);
              } else {
                // EditTask not on stack, navigate normally
                navigationRef.navigate("EditTask", { taskId });
                console.log("[App] ✓ Navigation command sent successfully");
              }
            } else {
              console.log("[App] ⏳ Navigation not ready, storing pending navigation...");
              pendingNavigationRef.current = { screen: "EditTask", params: { taskId } };
              // Also try retrying a few times
              let retryCount = 0;
              const retryInterval = setInterval(() => {
                retryCount++;
                if (navigationRef.isReady()) {
                  console.log("[App] Navigation ready on retry, executing navigate...");
                  // Check if EditTask is on stack and go back first if needed
                  const state = navigationRef.getState();
                  const editTaskIndex = state?.routes.findIndex(r => r.name === "EditTask");
                  
                  if (editTaskIndex !== undefined && editTaskIndex >= 0) {
                    navigationRef.goBack();
                    setTimeout(() => {
                      navigationRef.navigate("EditTask", { taskId });
                    }, 100);
                  } else {
                    navigationRef.navigate("EditTask", { taskId });
                  }
                  console.log("[App] ✓ Navigation command sent successfully");
                  clearInterval(retryInterval);
                  pendingNavigationRef.current = null;
                } else if (retryCount >= 20) {
                  console.warn("[App] ❌ Navigation not ready after 20 retries, will execute when ready");
                  clearInterval(retryInterval);
                }
              }, 100);
            }
          } catch (error) {
            console.error("[App] ❌ Error during navigation:", error);
          }
        } else {
          console.warn("[App] ❌ editTask deep link received but taskId parameter is missing");
          console.warn("[App] Full URL:", url);
          console.warn("[App] Regex match:", taskIdMatch);
        }
      } else if (url.includes("addTask")) {
        // Parse query parameters from deep link manually (React Native doesn't have URL.searchParams)
        const parseQueryParam = (url: string, param: string): string | null => {
          const regex = new RegExp(`[?&]${param}=([^&]*)`);
          const match = url.match(regex);
          return match ? decodeURIComponent(match[1]) : null;
        };
        
        const title = parseQueryParam(url, "title");
        const description = parseQueryParam(url, "description") || undefined;
        const dueDate = parseQueryParam(url, "dueDate") || undefined;
        const tasklistId = parseQueryParam(url, "tasklistId") || undefined;
        
        console.log("[App] Navigating to AddTask with params:", { title, description, dueDate, tasklistId });
        
        // If title is provided, this is from widget - auto-save
        if (title) {
          navigationRef.navigate("AddTask", { 
            title, 
            description, 
            dueDate, 
            taskListId: tasklistId,
            autoSave: true 
          });
        } else {
          navigationRef.navigate("AddTask", { taskListId: tasklistId });
        }
      }
    };

    // Handle initial URL only once on app startup (check ref to prevent multiple calls)
    if (!initialUrlProcessedRef.current) {
      initialUrlProcessedRef.current = true; // Set immediately to prevent race conditions
      Linking.getInitialURL().then((url) => {
        if (url && !url.includes("expo-development-client") && url.includes("com.magicmarinac.tasks://")) {
          console.log("[App] ========== Initial URL Detected (App Startup) ==========");
          console.log("[App] Initial URL:", url);
          // Wait a bit for navigation to be ready
          setTimeout(() => handleDeepLink(url), 500);
        } else {
          console.log("[App] Initial URL is Expo dev client or not a deep link, ignoring");
        }
      }).catch((error) => {
        console.error("[App] Error getting initial URL:", error);
      });
    }

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[App] ========== Deep Link Event Received ==========");
      console.log("[App] Event URL:", event.url);
      console.log("[App] Event type:", event.type);
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {/* <StatusBar style={scheme === "dark" ? "light" : "dark"} /> */}
      <Stack.Navigator
        id="AppStack"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="Root"
          component={AppDrawer}
        />
        <Stack.Screen
          name="AddTask"
          component={AddTaskScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="EditTask"
          component={EditTaskScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="TaskList"
          component={TaskListScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // keep splash visible until TaskProvider / load logic hides it
    SplashScreen.preventAutoHideAsync();
    registerForPushNotifications();
  }, []);

  const registerForPushNotifications = async () => {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        alert("Failed to get push token for push notification!");
        return;
      }
    } else {
      console.log("Must use physical device for Push Notifications");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <GoogleAuthProvider>
          <TaskProvider>
            <NavigationInner />
          </TaskProvider>
        </GoogleAuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
