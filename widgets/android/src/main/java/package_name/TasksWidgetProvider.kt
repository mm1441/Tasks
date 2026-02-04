package package_name

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PorterDuff
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import androidx.core.net.toUri

private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKLISTS_KEY = "taskLists"
private const val CURRENT_TASKLIST_ID_KEY = "currentTaskListId"
private const val THEME_KEY = "theme"
private const val TAG = "TasksWidget"

class TasksWidgetProvider : AppWidgetProvider() {
    
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        Log.d(TAG, "onUpdate called with ${appWidgetIds.size} widget IDs")
        for (appWidgetId in appWidgetIds) {
            Log.d(TAG, "Updating widget ID: $appWidgetId")
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        Log.d(TAG, "Widget deleted: ${appWidgetIds.contentToString()}")
    }
    
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle?
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateAppWidget(context, appWidgetManager, appWidgetId)
    }
    
    private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        // Load task lists, current list, and theme first (needed for layout choice)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val taskListsJson = prefs.getString(TASKLISTS_KEY, "[]") ?: "[]"
        val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
        val theme = prefs.getString(THEME_KEY, "Light") ?: "Light"
        val isDarkTheme = theme == "Dark"
        
        // Use theme-specific layout for correct ListView divider (light vs dark grey)
        val layoutId = if (isDarkTheme) R.layout.widget_layout_dark else R.layout.widget_layout
        val views = RemoteViews(context.packageName, layoutId)
        
        Log.d(TAG, "updateAppWidget: currentTaskListId=$currentTaskListId, taskListsJson length=${taskListsJson.length}, theme=$theme")
        
        // Apply theme colors (provider overrides some XML defaults for runtime theme switching)
        val headerBackgroundColor = if (isDarkTheme) 0xFF1E1E1E.toInt() else 0xFFFFFFFF.toInt()  // Solid
        val contentBackgroundColor = if (isDarkTheme) 0xC41E1E1E.toInt() else 0xC4FFFFFF.toInt()  // ~70% opacity
        val textColor = if (isDarkTheme) 0xFFFFFFFF.toInt() else 0xFF000000.toInt()
        val emptyTextColor = if (isDarkTheme) 0xFF999999.toInt() else 0xFF999999.toInt()
        val dividerColor = if (isDarkTheme) 0xFF333333.toInt() else 0xFFE0E0E0.toInt()
        val iconColor = if (isDarkTheme) 0xFFFFFFFF.toInt() else 0xFF000000.toInt()
        
        // Set header solid background, content area semi-transparent
        views.setInt(R.id.widget_header, "setBackgroundColor", headerBackgroundColor)
        views.setInt(R.id.widget_content, "setBackgroundColor", contentBackgroundColor)
        
        // Set task list dropdown text color
        views.setTextColor(R.id.task_list_dropdown, textColor)
        
        // Set empty view text color
        views.setTextColor(R.id.empty_view, emptyTextColor)
        
        // Set chevron icon - use white version for dark theme, regular for light
        if (isDarkTheme) {
            views.setImageViewResource(R.id.chevron_icon, R.drawable.ic_chevron_down_white)
        } else {
            views.setImageViewResource(R.id.chevron_icon, R.drawable.ic_chevron_down)
        }
        
        // Set add button icon - use white version for dark theme, regular for light
        if (isDarkTheme) {
            views.setImageViewResource(R.id.add_task_button, R.drawable.ic_add_white)
        } else {
            views.setImageViewResource(R.id.add_task_button, R.drawable.ic_add)
        }
        
        Log.d(TAG, "Theme applied: $theme (isDark: $isDarkTheme)")
        
        val gson = Gson()
        val type = object : TypeToken<List<Map<String, Any>>>() {}.type
        val taskLists = try {
            gson.fromJson<List<Map<String, Any>>>(taskListsJson, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing task lists", e)
            emptyList()
        }
        
        // Find current task list name
        val currentTaskList = taskLists.find { it["id"] == currentTaskListId }
        val currentListName = currentTaskList?.get("title") as? String ?: (if (taskLists.isNotEmpty()) taskLists[0]["title"] as? String ?: "My List" else "My List")
        
        // Set task list dropdown text (dynamic name)
        views.setTextViewText(R.id.task_list_dropdown, currentListName)
        
        // Set click intent for task list dropdown container (open config activity)
        val dropdownIntent = Intent(context, WidgetConfigActivity::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or Intent.FLAG_ACTIVITY_NO_HISTORY
        }
        val dropdownPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            dropdownIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.task_list_dropdown_container, dropdownPendingIntent)
        
        // Set click intent for + button (open AddTaskActivity)
        val addTaskIntent = Intent(context, AddTaskActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS or Intent.FLAG_ACTIVITY_NO_HISTORY
        }
        val addTaskPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId + 20000, // One request code per widget
            addTaskIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.add_task_button, addTaskPendingIntent)
        
        // Set click intent for header spacer (open HomeScreen)
        val openHomeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("package_name://home")).apply {
            setPackage(context.packageName)
            addCategory(Intent.CATEGORY_DEFAULT)
            addCategory(Intent.CATEGORY_BROWSABLE)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openHomePendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId + 40000,
            openHomeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.header_open_home, openHomePendingIntent)
        
        // Set up RemoteViewsService for ListView
        val intent = Intent(context, TaskListService::class.java)
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        intent.putExtra("theme", theme) // Pass theme to factory
        intent.data = intent.toUri(Intent.URI_INTENT_SCHEME).toUri()
        Log.d(TAG, "Setting RemoteAdapter with intent: ${intent.component}, theme: $theme")
        views.setRemoteAdapter(R.id.list_view, intent)
        views.setEmptyView(R.id.list_view, R.id.empty_view)
        
        // Set template PendingIntent for ListView items (required for ListView clicks in widgets)
        // Individual item clicks will use setOnClickFillInIntent in TaskRemoteViewsFactory
        val templateIntent = Intent(context, TasksWidgetProvider::class.java).apply {
            action = "${context.packageName}.OPEN_TASK"
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        val templatePendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            templateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.list_view, templatePendingIntent)
        Log.d(TAG, "========== Set pending intent template for list_view ==========")
        Log.d(TAG, "Widget ID: $appWidgetId")
        Log.d(TAG, "Template intent action: ${templateIntent.action}")
        Log.d(TAG, "Template intent extras: ${templateIntent.extras?.keySet()?.joinToString()}")
        Log.d(TAG, "Template intent class: ${templateIntent.component}")
        Log.d(TAG, "✓ Template PendingIntent set on list_view (will merge with fill-in intents)")
        
        appWidgetManager.updateAppWidget(appWidgetId, views)
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.list_view)
        Log.d(TAG, "Widget $appWidgetId updated, notified data changed")
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        Log.d(TAG, "onReceive called with action: ${intent.action}")
        
        when (intent.action) {
            "${context.packageName}.UPDATE_WIDGET" -> {
                Log.d(TAG, "Custom UPDATE_WIDGET action received")
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, TasksWidgetProvider::class.java))
                // First update the widget UI
                onUpdate(context, appWidgetManager, appWidgetIds)
                // Then notify data changed to reload tasks from SharedPreferences
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
                Log.d(TAG, "Notified ${appWidgetIds.size} widgets of data change")
            }
            "${context.packageName}.TOGGLE_TASK" -> {
                Log.d(TAG, "========== TOGGLE_TASK action received ==========")
                Log.d(TAG, "Intent action: ${intent.action}")
                Log.d(TAG, "Intent data URI: ${intent.data}")
                Log.d(TAG, "Intent component: ${intent.component}")
                
                // Log all extras
                val extras = intent.extras
                if (extras != null) {
                    Log.d(TAG, "Intent extras count: ${extras.size()}")
                    Log.d(TAG, "Intent extras keys: ${extras.keySet().joinToString()}")
                    for (key in extras.keySet()) {
                        val value = extras.get(key)
                        Log.d(TAG, "  Extra[$key] = $value (type: ${value?.javaClass?.simpleName})")
                    }
                } else {
                    Log.w(TAG, "⚠️ Intent has no extras!")
                }
                
                val taskId = intent.getStringExtra("taskId")
                val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
                
                Log.d(TAG, "Extracted taskId: $taskId")
                Log.d(TAG, "Extracted widgetId: $widgetId")
                
                if (taskId == null) {
                    Log.e(TAG, "❌ ERROR: TaskId is null, cannot toggle")
                    return
                }
                
                if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
                    Log.w(TAG, "⚠️ Widget ID is invalid, will update all widgets")
                }
                
                Log.d(TAG, "→ Calling toggleTask() for taskId: $taskId")
                val toggleResult = toggleTask(context, taskId)
                
                if (toggleResult) {
                    Log.d(TAG, "✓ Task toggled successfully, updating widget...")
                    // Update widget
                    val appWidgetManager = AppWidgetManager.getInstance(context)
                    if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                        appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.list_view)
                        Log.d(TAG, "✓ Notified widget $widgetId of data change")
                    } else {
                        val appWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, TasksWidgetProvider::class.java))
                        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
                        Log.d(TAG, "✓ Notified ${appWidgetIds.size} widgets of data change")
                    }
                } else {
                    Log.e(TAG, "❌ Failed to toggle task (task not found or error occurred)")
                }
            }
            "${context.packageName}.OPEN_TASK" -> {
                Log.d(TAG, "========== OPEN_TASK action received ==========")
                Log.d(TAG, "Intent action: ${intent.action}")
                Log.d(TAG, "Intent data URI: ${intent.data}")
                Log.d(TAG, "Intent component: ${intent.component}")
                Log.d(TAG, "Intent flags: ${intent.flags}")
                
                // Log all extras
                val extras = intent.extras
                if (extras != null) {
                    Log.d(TAG, "Intent extras count: ${extras.size()}")
                    Log.d(TAG, "Intent extras keys: ${extras.keySet().joinToString()}")
                    for (key in extras.keySet()) {
                        val value = extras.get(key)
                        Log.d(TAG, "  Extra[$key] = $value (type: ${value?.javaClass?.simpleName})")
                    }
                } else {
                    Log.w(TAG, "⚠️ Intent has no extras!")
                }
                
                val taskId = intent.getStringExtra("taskId")
                val isCheckboxClick = intent.getBooleanExtra("isCheckboxClick", false)
                val deepLinkUri = intent.getStringExtra("deepLinkUri")
                val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
                
                Log.d(TAG, "Extracted taskId: $taskId")
                Log.d(TAG, "Extracted isCheckboxClick: $isCheckboxClick")
                Log.d(TAG, "Extracted deepLinkUri: $deepLinkUri")
                Log.d(TAG, "Extracted widgetId: $widgetId")
                
                // Check if this is a checkbox click (toggle task) or text click (open EditTaskScreen)
                if (isCheckboxClick || (intent.data != null && intent.data.toString().contains("checkbox"))) {
                    Log.d(TAG, "========== Detected checkbox click - toggling task ==========")
                    if (taskId == null) {
                        Log.e(TAG, "❌ ERROR: TaskId is null, cannot toggle")
                        return@onReceive
                    }
                    
                    Log.d(TAG, "→ Calling toggleTask() for taskId: $taskId")
                    val toggleResult = toggleTask(context, taskId)
                    
                    if (toggleResult) {
                        Log.d(TAG, "✓ Task toggled successfully, updating widget...")
                        // Update widget
                        val appWidgetManager = AppWidgetManager.getInstance(context)
                        if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                            appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.list_view)
                            Log.d(TAG, "✓ Notified widget $widgetId of data change")
                        } else {
                            val appWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, TasksWidgetProvider::class.java))
                            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
                            Log.d(TAG, "✓ Notified ${appWidgetIds.size} widgets of data change")
                        }
                    } else {
                        Log.e(TAG, "❌ Failed to toggle task (task not found or error occurred)")
                    }
                    return@onReceive // Don't proceed to open EditTaskScreen
                }
                
                // This is a text click - open EditTaskScreen
                Log.d(TAG, "========== Detected text click - opening EditTaskScreen ==========")
                
                // Extract deepLinkUri from intent (either direct or from fill-in intent)
                val finalDeepLinkUri = deepLinkUri ?: run {
                    // If not in extras, try to construct from taskId
                    if (taskId == null) {
                        Log.e(TAG, "❌ ERROR: Both taskId and deepLinkUri are null! Cannot proceed.")
                        Log.e(TAG, "This means the fill-in intent did not merge properly with the template intent.")
                        return@onReceive
                    }
                    val constructed = "package_name://editTask?taskId=$taskId"
                    Log.d(TAG, "Constructed deep link URI from taskId: $constructed")
                    constructed
                }
                
                Log.d(TAG, "Final deep link URI: $finalDeepLinkUri")
                
                // Launch MainActivity with deep link
                val activityIntent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse(finalDeepLinkUri)
                    addCategory(Intent.CATEGORY_DEFAULT)
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    setPackage(context.packageName)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                Log.d(TAG, "========== Launching MainActivity ==========")
                Log.d(TAG, "Deep link URI: $finalDeepLinkUri")
                Log.d(TAG, "Activity intent action: ${activityIntent.action}")
                Log.d(TAG, "Activity intent data: ${activityIntent.data}")
                Log.d(TAG, "Activity intent package: ${activityIntent.`package`}")
                Log.d(TAG, "Activity intent categories: ${activityIntent.categories?.joinToString()}")
                Log.d(TAG, "Activity intent flags: ${activityIntent.flags}")
                
                try {
                    context.startActivity(activityIntent)
                    Log.d(TAG, "✓ Activity launch command sent successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ ERROR launching activity", e)
                    Log.e(TAG, "Exception message: ${e.message}")
                    Log.e(TAG, "Exception stack trace:", e)
                }
            }
        }
    }
    
    private fun toggleTask(context: Context, taskId: String): Boolean {
        Log.d(TAG, "========== toggleTask() called ==========")
        Log.d(TAG, "Task ID: $taskId")
        
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val tasksJson = prefs.getString("tasks", "[]") ?: "[]"
            
            Log.d(TAG, "Loaded tasks JSON from SharedPreferences")
            Log.d(TAG, "JSON length: ${tasksJson.length}")
            
            val gson = Gson()
            val type = object : TypeToken<MutableList<MutableMap<String, Any>>>() {}.type
            val tasks = gson.fromJson<MutableList<MutableMap<String, Any>>>(tasksJson, type) ?: mutableListOf()
            
            Log.d(TAG, "Parsed ${tasks.size} tasks from JSON")
            
            val taskIndex = tasks.indexOfFirst { it["id"] == taskId }
            Log.d(TAG, "Task index: $taskIndex")
            
            if (taskIndex >= 0) {
                val task = tasks[taskIndex]
                val currentCompleted = task["isCompleted"] as? Boolean ?: false
                val newCompleted = !currentCompleted
                
                Log.d(TAG, "Found task at index $taskIndex")
                Log.d(TAG, "Task title: ${task["title"]}")
                Log.d(TAG, "Current completed state: $currentCompleted")
                Log.d(TAG, "New completed state: $newCompleted")
                
                tasks[taskIndex]["isCompleted"] = newCompleted
                
                val updatedJson = gson.toJson(tasks)
                Log.d(TAG, "Updated JSON length: ${updatedJson.length}")
                
                // Use commit() for synchronous write to ensure data is persisted before widget update
                val saved = prefs.edit().putString("tasks", updatedJson).commit()
                Log.d(TAG, "Saved to SharedPreferences: $saved")
                
                // Notify the app to update the task
                val updateIntent = Intent("${context.packageName}.WIDGET_TASK_UPDATED").apply {
                    putExtra("taskId", taskId)
                    putExtra("isCompleted", newCompleted)
                }
                context.sendBroadcast(updateIntent)
                Log.d(TAG, "✓ Broadcast sent: ${context.packageName}.WIDGET_TASK_UPDATED")
                Log.d(TAG, "  Broadcast extras: taskId=$taskId, isCompleted=$newCompleted")
                
                Log.d(TAG, "✓ Successfully toggled task $taskId from $currentCompleted to $newCompleted")
                return true
            } else {
                Log.e(TAG, "❌ Task not found! TaskId: $taskId")
                Log.e(TAG, "Available task IDs: ${tasks.map { it["id"] }.joinToString()}")
                return false
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ ERROR toggling task", e)
            Log.e(TAG, "Exception message: ${e.message}")
            e.printStackTrace()
            return false
        }
    }
}
