import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { TaskProvider } from "./context/TaskContext"
import HomeScreen from "./screens/HomeScreen"
import AddTaskScreen from "./screens/NewTaskScreen"
import EditTaskScreen from "./screens/EditTaskScreen";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

export type RootStackParamList = {
  Home: undefined
  AddTask: undefined
  EditTask: { taskId: string };
}

const Stack = createNativeStackNavigator<RootStackParamList>()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  useEffect(() => {
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
    <TaskProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator
          id="AppStack"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
          />
          <Stack.Screen
            name="AddTask"
            component={AddTaskScreen}
            options={{
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="EditTask"
            component={EditTaskScreen}
            options={{ presentation: "modal" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </TaskProvider>
  )
}
