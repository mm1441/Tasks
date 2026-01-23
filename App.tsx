import { useEffect, useRef } from "react";
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

  // Handle deep links from widget
  useEffect(() => {
    const handleDeepLink = (url: string, retryCount = 0) => {
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

      console.log("[App] Deep link received:", url);

      // Maximum 5 retries (1 second total)
      if (!navigationRef.isReady()) {
        if (retryCount < 5) {
          console.log("[App] Navigation not ready yet, waiting... (retry", retryCount + 1, ")");
          setTimeout(() => handleDeepLink(url, retryCount + 1), 200);
          return;
        } else {
          console.log("[App] Navigation not ready after retries, giving up");
          return;
        }
      }

      if (url.includes("editTask")) {
        const taskIdMatch = url.match(/taskId=([^&]+)/);
        if (taskIdMatch && taskIdMatch[1]) {
          const taskId = taskIdMatch[1];
          console.log("[App] Navigating to EditTask with taskId:", taskId);
          navigationRef.navigate("EditTask", { taskId });
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

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("[App] Initial URL:", url);
        // Wait a bit for navigation to be ready
        setTimeout(() => handleDeepLink(url), 500);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      console.log("[App] Deep link event:", event.url);
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
