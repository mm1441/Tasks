# Widget to App Communication Flow

This document explains how clicking a task item in the Android widget opens the EditTaskScreen in the React Native/Expo app.

## Overview

The communication happens through:
1. **Android Widget System** - Native Android code handles widget clicks
2. **SharedPreferences** - Bridge for data sharing between widget and app
3. **Deep Links** - Launch the app and navigate to specific screens
4. **React Native Linking API** - Receives deep links and navigates

---

## Complete Flow: Widget Click → EditTaskScreen

### Step 1: User Clicks Task Item in Widget
**File:** `task_item.xml` (lines 3-11, 26-38)
- User clicks on `task_item_container` or `task_title` TextView
- Both are clickable and have fill-in intents set

**Logs to check:**
- No direct logs here (XML layout)

---

### Step 2: Fill-In Intent Created
**File:** `TaskRemoteViewsFactory.kt` (lines 132-150)
- `getViewAt(position)` creates a RemoteViews for each task item
- Creates a fill-in Intent with:
  - `taskId` extra
  - `deepLinkUri` extra: `"com.magicmarinac.tasks://editTask?taskId=$taskId"`
  - Widget ID extra
- Sets fill-in intent on both `task_item_container` and `task_title` using `setOnClickFillInIntent()`

**Key Point:** Fill-in intents MUST be used for ListView items in widgets. They merge with a template PendingIntent.

**Logs to check:**
```
[TasksWidget] ========== Creating task click fill-in intent ==========
[TasksWidget] Task ID: <taskId>
[TasksWidget] Task title: <title>
[TasksWidget] Position: <position>
[TasksWidget] Widget ID: <widgetId>
[TasksWidget] Deep link URI: com.magicmarinac.tasks://editTask?taskId=<taskId>
[TasksWidget] ✓ Fill-in intent set on task_item_container and task_title
```

---

### Step 3: Template PendingIntent Setup
**File:** `TasksWidgetProvider.kt` (lines 104-117)
- During widget update, sets a template PendingIntent on the ListView
- Template intent has action: `"${packageName}.OPEN_TASK"`
- This template merges with fill-in intents when items are clicked

**Key Point:** Android merges the fill-in intent extras into the template intent when clicked.

**Logs to check:**
```
[TasksWidget] ========== Set pending intent template for list_view ==========
[TasksWidget] Widget ID: <widgetId>
[TasksWidget] Template intent action: com.magicmarinac.tasks.OPEN_TASK
[TasksWidget] ✓ Template PendingIntent set on list_view
```

---

### Step 4: Intent Broadcast Received
**File:** `TasksWidgetProvider.kt` (lines 161-191)
- When user clicks task item, Android merges fill-in intent with template
- `onReceive()` is called with action `"${packageName}.OPEN_TASK"`
- Extracts `taskId` and `deepLinkUri` from merged intent extras

**Key Point:** If `taskId` or `deepLinkUri` are null, the fill-in intent didn't merge properly.

**Logs to check:**
```
[TasksWidget] ========== OPEN_TASK action received ==========
[TasksWidget] Intent action: com.magicmarinac.tasks.OPEN_TASK
[TasksWidget] Intent extras keys: taskId, deepLinkUri, appWidgetId
[TasksWidget] Extracted taskId: <taskId>
[TasksWidget] Extracted deepLinkUri: com.magicmarinac.tasks://editTask?taskId=<taskId>
[TasksWidget] Final deep link URI: <deepLinkUri>
```

**If you see:**
```
[TasksWidget] ❌ ERROR: Both taskId and deepLinkUri are null!
```
This means the fill-in intent didn't merge with the template intent. Check:
- Template PendingIntent is set correctly
- Fill-in intent is set on the correct view IDs
- PendingIntent flags are correct (FLAG_MUTABLE for template)

---

### Step 5: Launch MainActivity with Deep Link
**File:** `TasksWidgetProvider.kt` (lines 178-190)
- Creates an Intent with `ACTION_VIEW` and the deep link URI
- Sets categories: `CATEGORY_DEFAULT`, `CATEGORY_BROWSABLE`
- Launches MainActivity (handled by Expo)

**Logs to check:**
```
[TasksWidget] ========== Launching MainActivity ==========
[TasksWidget] Deep link URI: com.magicmarinac.tasks://editTask?taskId=<taskId>
[TasksWidget] Activity intent action: android.intent.action.VIEW
[TasksWidget] Activity intent data: <deepLinkUri>
[TasksWidget] ✓ Activity launch command sent successfully
```

---

### Step 6: Expo Receives Deep Link
**File:** `App.tsx` (lines 102-265)
- React Native `Linking` API receives the deep link
- Two scenarios:
  - **App is running:** `Linking.addEventListener("url")` fires
  - **App is closed:** `Linking.getInitialURL()` is called on startup

**Logs to check:**
```
[App] ========== Deep Link Handler Called ==========
[App] Full URL received: com.magicmarinac.tasks://editTask?taskId=<taskId>
[App] ✓ Valid deep link detected
[App] → Processing editTask deep link
[App] ✓ TaskId extracted: <taskId>
[App] → Navigating to EditTask screen with taskId: <taskId>
```

---

### Step 7: Navigate to EditTaskScreen
**File:** `App.tsx` (lines 137-206)
- Extracts `taskId` from URL using regex: `/taskId=([^&]+)/`
- Checks if navigation is ready
- Navigates to `EditTask` screen with `{ taskId }` params

**Logs to check:**
```
[App] Navigation is ready, executing navigate...
[App] ✓ Navigation command sent successfully
```

---

### Step 8: EditTaskScreen Renders
**File:** `EditTaskScreen.tsx` (lines 24-45)
- Receives `taskId` from route params
- Finds task from `tasks` array using `tasks.find((t) => t.id === taskId)`
- Displays task details

**Logs to check:**
```
[EditTaskScreen] ========== Screen Rendered ==========
[EditTaskScreen] Route params: { taskId: "<taskId>" }
[EditTaskScreen] TaskId from route: <taskId>
[EditTaskScreen] Task found: YES
[EditTaskScreen] Task title: <title>
```

---

## SharedPreferences Bridge

### How It Works

**Widget → App:**
- Widget reads tasks from SharedPreferences (`tasks_widget_prefs`)
- Widget displays tasks in ListView
- When clicked, widget launches deep link (no SharedPreferences needed for click)

**App → Widget:**
- App writes tasks to SharedPreferences via `WidgetStorageModule`
- App calls `updateWidget()` which broadcasts `UPDATE_WIDGET` action
- Widget receives broadcast and refreshes its data

**File:** `WidgetStorageModule.kt`
- `setTasks(json)` - Writes tasks JSON to SharedPreferences
- `setTaskLists(json)` - Writes task lists JSON
- `setCurrentTaskListId(id)` - Sets current list ID
- `updateWidget()` - Broadcasts update to widget

**SharedPreferences Key:** `"tasks_widget_prefs"`

**Keys used:**
- `"tasks"` - JSON array of tasks
- `"taskLists"` - JSON array of task lists
- `"currentTaskListId"` - Current selected task list ID
- `"showCompleted"` - Boolean flag for showing completed tasks

---

## Debugging Checklist

If clicking a task item doesn't work, check logs in this order:

1. **Fill-in Intent Creation** (`TaskRemoteViewsFactory.kt`)
   - ✓ Fill-in intent is created with correct taskId
   - ✓ Fill-in intent is set on `task_item_container` and `task_title`

2. **Template Intent Setup** (`TasksWidgetProvider.kt`)
   - ✓ Template PendingIntent is set on ListView
   - ✓ Template intent has correct action (`OPEN_TASK`)

3. **Intent Broadcast** (`TasksWidgetProvider.onReceive`)
   - ✓ `OPEN_TASK` action is received
   - ✓ `taskId` and `deepLinkUri` extras are present
   - ⚠️ If null, fill-in intent didn't merge properly

4. **Activity Launch** (`TasksWidgetProvider.onReceive`)
   - ✓ MainActivity launch command sent
   - ⚠️ Check for exceptions

5. **Deep Link Reception** (`App.tsx`)
   - ✓ Deep link URL is received
   - ✓ URL matches pattern `com.magicmarinac.tasks://editTask?taskId=...`
   - ✓ TaskId is extracted correctly

6. **Navigation** (`App.tsx`)
   - ✓ Navigation is ready
   - ✓ Navigate command sent
   - ⚠️ Check for navigation errors

7. **Screen Rendering** (`EditTaskScreen.tsx`)
   - ✓ Screen receives taskId in route params
   - ✓ Task is found in tasks array
   - ⚠️ If task not found, check if taskId matches

---

## Common Issues

### Issue: Click does nothing
**Symptoms:** No logs appear when clicking task item

**Possible causes:**
1. Fill-in intent not set on correct view ID
2. Template PendingIntent not set on ListView
3. View IDs don't match between XML and Kotlin code

**Check:**
- Verify `task_item_container` ID exists in `task_item.xml`
- Verify `list_view` ID exists in `widget_layout.xml`
- Check that `setOnClickFillInIntent()` is called (not `setOnClickPendingIntent()`)

---

### Issue: OPEN_TASK received but taskId is null
**Symptoms:** Logs show `OPEN_TASK` action but `taskId` is null

**Possible causes:**
1. Fill-in intent extras not merging with template
2. PendingIntent flags incorrect (need `FLAG_MUTABLE` for template)

**Check:**
- Template PendingIntent uses `FLAG_MUTABLE`
- Fill-in intent has `taskId` extra set
- Both intents use same widget ID

---

### Issue: Deep link not received in App.tsx
**Symptoms:** Widget logs show activity launch, but App.tsx doesn't receive URL

**Possible causes:**
1. Deep link URL format incorrect
2. AndroidManifest.xml missing intent-filter
3. App not registered to handle deep links

**Check:**
- URL format: `com.magicmarinac.tasks://editTask?taskId=...`
- AndroidManifest.xml has intent-filter with scheme `com.magicmarinac.tasks`
- App is installed and can handle deep links

---

### Issue: Task not found in EditTaskScreen
**Symptoms:** Screen opens but shows "Task not found"

**Possible causes:**
1. TaskId mismatch between widget and app
2. Tasks not loaded in app yet
3. Task was deleted

**Check:**
- Compare taskId from widget logs with taskId in EditTaskScreen logs
- Verify tasks are loaded in TaskContext
- Check if task exists in SharedPreferences

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `task_item.xml` | Layout for individual task items in widget |
| `widget_layout.xml` | Main widget layout with ListView |
| `TaskRemoteViewsFactory.kt` | Creates RemoteViews for each task item, sets fill-in intents |
| `TasksWidgetProvider.kt` | Widget provider, handles clicks, launches deep links |
| `WidgetStorageModule.kt` | Bridge between React Native and SharedPreferences |
| `App.tsx` | React Native app entry, handles deep links, navigates |
| `EditTaskScreen.tsx` | Screen that displays task details for editing |

---

## Log Tag Reference

All widget-related logs use tag: **`TasksWidget`**

Filter logs with: `adb logcat -s TasksWidget`

React Native logs use: **`[App]`** and **`[EditTaskScreen]`**

Filter all relevant logs: `adb logcat | grep -E "TasksWidget|\[App\]|\[EditTaskScreen\]"`
