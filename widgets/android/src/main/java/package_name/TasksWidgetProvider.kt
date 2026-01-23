package package_name

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKLISTS_KEY = "taskLists"
private const val CURRENT_TASKLIST_ID_KEY = "currentTaskListId"
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
        val views = RemoteViews(context.packageName, R.layout.widget_layout)
        
        // Load task lists and current list
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val taskListsJson = prefs.getString(TASKLISTS_KEY, "[]") ?: "[]"
        val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
        
        Log.d(TAG, "updateAppWidget: currentTaskListId=$currentTaskListId, taskListsJson length=${taskListsJson.length}")
        
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
        
        // Set up RemoteViewsService for ListView
        val intent = Intent(context, TaskListService::class.java)
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        intent.data = Uri.parse(intent.toUri(Intent.URI_INTENT_SCHEME))
        Log.d(TAG, "Setting RemoteAdapter with intent: ${intent.component}")
        views.setRemoteAdapter(R.id.list_view, intent)
        views.setEmptyView(R.id.list_view, R.id.empty_view)
        
        // Set template for list item clicks (for task item clicks) - one per widget
        // Must use FLAG_MUTABLE for fillInIntent to work properly
        val templateIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("com.magicmarinac.tasks://editTask")
            setPackage(context.packageName)
        }
        val templatePendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId + 30000, // One request code per widget
            templateIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.list_view, templatePendingIntent)
        
        // Note: Checkboxes use individual PendingIntents (appWidgetId * 10000 + position) 
        // because they're inside ListView items and can't use templates directly
        
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
                Log.d(TAG, "TOGGLE_TASK action received")
                val taskId = intent.getStringExtra("taskId") ?: return
                val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
                toggleTask(context, taskId)
                
                // Update widget
                val appWidgetManager = AppWidgetManager.getInstance(context)
                if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    appWidgetManager.notifyAppWidgetViewDataChanged(widgetId, R.id.list_view)
                } else {
                    val appWidgetIds = appWidgetManager.getAppWidgetIds(ComponentName(context, TasksWidgetProvider::class.java))
                    appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
                }
            }
        }
    }
    
    private fun toggleTask(context: Context, taskId: String) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val tasksJson = prefs.getString("tasks", "[]") ?: "[]"
            
            val gson = Gson()
            val type = object : TypeToken<MutableList<MutableMap<String, Any>>>() {}.type
            val tasks = gson.fromJson<MutableList<MutableMap<String, Any>>>(tasksJson, type) ?: mutableListOf()
            
            val taskIndex = tasks.indexOfFirst { it["id"] == taskId }
            if (taskIndex >= 0) {
                val currentCompleted = tasks[taskIndex]["isCompleted"] as? Boolean ?: false
                tasks[taskIndex]["isCompleted"] = !currentCompleted
                
                val updatedJson = gson.toJson(tasks)
                // Use commit() for synchronous write to ensure data is persisted before widget update
                prefs.edit().putString("tasks", updatedJson).commit()
                
                // Notify the app to update the task
                val updateIntent = Intent("${context.packageName}.WIDGET_TASK_UPDATED").apply {
                    putExtra("taskId", taskId)
                    putExtra("isCompleted", !currentCompleted)
                }
                context.sendBroadcast(updateIntent)
                
                Log.d(TAG, "Toggled task $taskId to ${!currentCompleted}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error toggling task", e)
        }
    }
}