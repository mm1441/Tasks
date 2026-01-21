import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
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


export type RootStackParamList = {
  Root: undefined;
  Home: undefined;
  AddTask: { taskListId?: string };
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

  return (
    <NavigationContainer theme={navTheme}>
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
