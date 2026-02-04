package package_name

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.Paint
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
    private val theme: String = intent.getStringExtra("theme") ?: "Light"

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
            // Preserve array order from main app - matches user's drag-reorder (custom sort) in HomeScreen
            val filteredTasks = allTasks.filter { task ->
                val taskListId = task["tasklistId"] as? String ?: ""
                val isCompleted = task["isCompleted"] as? Boolean ?: false
                val matchesList = taskListId == currentTaskListId
                val matchesCompleted = showCompleted || !isCompleted
                matchesList && matchesCompleted
            }
            
            tasks = filteredTasks
            
            Log.d(TAG, "Loaded ${allTasks.size} total tasks, ${tasks.size} tasks for current list (showCompleted=$showCompleted)")
            Log.d(TAG, "Tasks order preserved from main app (matches drag-reorder)")
            tasks.forEachIndexed { index, task ->
                val dueDate = task["dueDate"] as? String ?: "no due date"
                val createdAt = task["createdAt"] as? String ?: "no created date"
                Log.d(TAG, "Task $index: ${task["title"]} (dueDate: $dueDate, createdAt: $createdAt)")
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
            
            // Apply theme colors
            val isDarkTheme = theme == "Dark"
            val normalTextColor = if (isDarkTheme) 0xFFFFFFFF.toInt() else 0xFF000000.toInt() // White for dark, black for light
            val completedTextColor = 0xFF999999.toInt() // Gray for completed (same in both themes)
            
            // Set strikethrough and text color based on completion state
            if (isCompleted) {
                // Set strikethrough paint flag
                val paintFlags = Paint.STRIKE_THRU_TEXT_FLAG or Paint.ANTI_ALIAS_FLAG
                rv.setInt(R.id.task_title, "setPaintFlags", paintFlags)
                // Set text color to a muted gray for completed tasks
                rv.setTextColor(R.id.task_title, completedTextColor)
                Log.d(TAG, "Set strikethrough and gray color for completed task: $title")
            } else {
                // Remove strikethrough and set normal text color based on theme
                val paintFlags = Paint.ANTI_ALIAS_FLAG
                rv.setInt(R.id.task_title, "setPaintFlags", paintFlags)
                rv.setTextColor(R.id.task_title, normalTextColor)
                Log.d(TAG, "Set normal text color (theme: $theme) for task: $title")
            }
            
            // Set checkbox icon based on completion state - use Ionicons-style icons
            val checkboxIcon = if (isCompleted) {
                R.drawable.ic_checkbox_checked
            } else {
                R.drawable.ic_checkbox_unchecked
            }
            rv.setImageViewResource(R.id.task_checkbox, checkboxIcon)
            
            // Set fill-in intent for checkbox (toggle completion)
            // MUST use fill-in intent (not PendingIntent) because ListView items intercept child clicks
            // We'll distinguish checkbox clicks from text clicks using the data URI
            Log.d(TAG, "========== Creating checkbox fill-in intent ==========")
            Log.d(TAG, "Task ID: $taskId")
            Log.d(TAG, "Task title: $title")
            Log.d(TAG, "Position: $position")
            Log.d(TAG, "Widget ID: $appWidgetId")
            Log.d(TAG, "Current completed state: $isCompleted")
            
            val checkboxFillInIntent = Intent().apply {
                putExtra("taskId", taskId)
                putExtra("isCheckboxClick", true) // Marker to identify checkbox clicks
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse("widget://task/checkbox/$taskId") // Different URI pattern
            }
            Log.d(TAG, "Checkbox fill-in intent data URI: ${checkboxFillInIntent.data}")
            Log.d(TAG, "Checkbox fill-in intent extras: ${checkboxFillInIntent.extras?.keySet()?.joinToString()}")
            
            rv.setOnClickFillInIntent(R.id.task_checkbox, checkboxFillInIntent)
            Log.d(TAG, "✓ Checkbox fill-in intent set on task_checkbox (ID: ${R.id.task_checkbox}) for taskId: $taskId")
            
            // Set fill-in intent for task item click (open EditTaskScreen)
            // MUST use setOnClickFillInIntent for ListView items (not setOnClickPendingIntent)
            // This fill-in intent will be merged with the template PendingIntent set in TasksWidgetProvider
            val deepLinkUri = "package_name://editTask?taskId=$taskId"
            val textFillInIntent = Intent().apply {
                putExtra("taskId", taskId)
                putExtra("deepLinkUri", deepLinkUri)
                putExtra("isCheckboxClick", false) // Marker to identify text clicks
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse("widget://task/item/$taskId") // Different URI pattern
            }
            
            Log.d(TAG, "========== Creating task text click fill-in intent ==========")
            Log.d(TAG, "Task ID: $taskId")
            Log.d(TAG, "Task title: $title")
            Log.d(TAG, "Position: $position")
            Log.d(TAG, "Widget ID: $appWidgetId")
            Log.d(TAG, "Deep link URI: $deepLinkUri")
            Log.d(TAG, "Text fill-in intent data URI: ${textFillInIntent.data}")
            Log.d(TAG, "Text fill-in intent extras: ${textFillInIntent.extras?.keySet()?.joinToString()}")
            
            // Set fill-in intent on TextView for opening EditTaskScreen
            rv.setOnClickFillInIntent(R.id.task_title, textFillInIntent)
            Log.d(TAG, "✓ Text fill-in intent set on task_title (ID: ${R.id.task_title})")
            Log.d(TAG, "  → When clicked, this will merge with template intent and trigger OPEN_TASK broadcast")
            
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
