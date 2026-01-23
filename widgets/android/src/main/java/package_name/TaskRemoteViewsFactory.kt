package package_name

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKS_KEY = "tasks"
private const val CURRENT_TASKLIST_ID_KEY = "currentTaskListId"
private const val SHOW_COMPLETED_KEY = "showCompleted"
private const val TAG = "TasksWidget"

class TaskRemoteViewsFactory(
    private val context: Context,
    intent: Intent
) : RemoteViewsService.RemoteViewsFactory {

    private var tasks: List<Map<String, Any>> = emptyList()
    private val gson = Gson()
    private val appWidgetId: Int = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)

    override fun onCreate() {
        Log.d(TAG, "onCreate called")
        loadTasks()
    }

    override fun onDataSetChanged() {
        Log.d(TAG, "onDataSetChanged called")
        loadTasks()
    }

    private fun loadTasks() {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(TASKS_KEY, "[]") ?: "[]"
            val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
            val showCompleted = prefs.getBoolean(SHOW_COMPLETED_KEY, false)
            
            Log.d(TAG, "Loading tasks from SharedPreferences")
            Log.d(TAG, "Current task list ID: $currentTaskListId")
            Log.d(TAG, "Show completed: $showCompleted")
            Log.d(TAG, "JSON length: ${json.length}")

            val type = object : TypeToken<List<Map<String, Any>>>() {}.type
            val allTasks = gson.fromJson<List<Map<String, Any>>>(json, type) ?: emptyList()
            
            // Filter tasks by current task list ID and completed status
            // Note: isDeleted tasks are already filtered out before being stored in SharedPreferences
            tasks = allTasks.filter { task ->
                val taskListId = task["tasklistId"] as? String ?: ""
                val isCompleted = task["isCompleted"] as? Boolean ?: false
                val matchesList = taskListId == currentTaskListId
                val matchesCompleted = showCompleted || !isCompleted
                matchesList && matchesCompleted
            }
            
            Log.d(TAG, "Loaded ${allTasks.size} total tasks, ${tasks.size} tasks for current list (showCompleted=$showCompleted)")
            tasks.forEachIndexed { index, task ->
                Log.d(TAG, "Task $index: ${task["title"]}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading tasks", e)
            tasks = emptyList()
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy called")
        tasks = emptyList()
    }

    override fun getCount(): Int {
        val count = tasks.size
        Log.d(TAG, "getCount() called, returning: $count")
        return count
    }

    override fun getViewAt(position: Int): RemoteViews {
        Log.d(TAG, "getViewAt($position) called")
        try {
            if (position >= tasks.size) {
                Log.e(TAG, "Position $position out of bounds, tasks.size = ${tasks.size}")
                return RemoteViews(context.packageName, R.layout.task_item).apply {
                    setTextViewText(R.id.task_title, "")
                }
            }
            
            val task = tasks[position]
            val taskId = task["id"] as? String ?: ""
            val title = task["title"] as? String ?: ""
            val isCompleted = task["isCompleted"] as? Boolean ?: false
            
            Log.d(TAG, "Creating view for task at position $position: $title (completed: $isCompleted)")
            
            val rv = RemoteViews(context.packageName, R.layout.task_item)
            
            // Set task title
            rv.setTextViewText(R.id.task_title, title)
            
            // Set checkbox icon based on completion state
            val checkboxIcon = if (isCompleted) {
                android.R.drawable.checkbox_on_background
            } else {
                android.R.drawable.checkbox_off_background
            }
            rv.setImageViewResource(R.id.task_checkbox, checkboxIcon)
            
            // Set click intent for checkbox (toggle completion)
            // Use individual PendingIntent with unique request code per widget: appWidgetId * 10000 + position
            // Must use explicit component for broadcast to be received
            val checkboxIntent = Intent(context, TasksWidgetProvider::class.java).apply {
                action = "${context.packageName}.TOGGLE_TASK"
                putExtra("taskId", taskId)
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse("widget://task/checkbox/$taskId")
            }
            val checkboxPendingIntent = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10000 + position, // Unique per widget and position
                checkboxIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )
            rv.setOnClickPendingIntent(R.id.task_checkbox, checkboxPendingIntent)
            
            // Set fillInIntent for entire task item (open EditTaskScreen) - uses template
            val taskFillIntent = Intent().apply {
                data = Uri.parse("com.magicmarinac.tasks://editTask?taskId=$taskId")
            }
            rv.setOnClickFillInIntent(R.id.task_item_container, taskFillIntent)
            
            return rv
        } catch (e: Exception) {
            Log.e(TAG, "Error in getViewAt($position)", e)
            return RemoteViews(context.packageName, R.layout.task_item).apply {
                setTextViewText(R.id.task_title, "Error")
            }
        }
    }

    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = true
}
