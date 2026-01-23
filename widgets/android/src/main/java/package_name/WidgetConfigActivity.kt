package package_name

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKLISTS_KEY = "taskLists"
private const val CURRENT_TASKLIST_ID_KEY = "currentTaskListId"
private const val TAG = "WidgetConfig"

class WidgetConfigActivity : Activity() {
    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        Log.d(TAG, "WidgetConfigActivity.onCreate called")
        
        // Set result to CANCELED in case user backs out
        setResult(RESULT_CANCELED)
        
        // Get widget ID from intent
        val intent = intent
        val extras = intent.extras
        Log.d(TAG, "Intent extras: $extras")
        
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
            Log.d(TAG, "Widget ID from extras: $appWidgetId")
        }
        
        // If no valid widget ID, finish
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            Log.e(TAG, "Invalid widget ID, finishing")
            finish()
            return
        }
        
        Log.d(TAG, "Loading task lists for widget configuration")
        
        // Load task lists
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val taskListsJson = prefs.getString(TASKLISTS_KEY, "[]") ?: "[]"
        val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
        
        Log.d(TAG, "Task lists JSON: $taskListsJson")
        Log.d(TAG, "Current task list ID: $currentTaskListId")
        
        val gson = Gson()
        val type = object : TypeToken<List<Map<String, Any>>>() {}.type
        val taskLists = try {
            gson.fromJson<List<Map<String, Any>>>(taskListsJson, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing task lists", e)
            emptyList()
        }
        
        Log.d(TAG, "Parsed ${taskLists.size} task lists")
        
        if (taskLists.isEmpty()) {
            // No task lists, show message and finish
            Log.w(TAG, "No task lists available")
            AlertDialog.Builder(this)
                .setTitle("No Task Lists")
                .setMessage("Please create a task list in the app first.")
                .setPositiveButton("OK") { _, _ -> 
                    finish()
                }
                .setOnCancelListener { finish() }
                .show()
            return
        }
        
        // Create dialog content view
        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 32)
        }
        
        // Task List Selection
        val taskListLabel = android.widget.TextView(this).apply {
            text = "Task List"
            textSize = 16f
            setPadding(0, 0, 0, 8)
        }
        dialogView.addView(taskListLabel)
        
        val taskListSpinner = Spinner(this)
        val listNames = taskLists.map { it["title"] as? String ?: "" }
        var adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, listNames)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        taskListSpinner.adapter = adapter
        
        // Find current selection index
        val currentIndex = taskLists.indexOfFirst { it["id"] == currentTaskListId }
        if (currentIndex >= 0) {
            taskListSpinner.setSelection(currentIndex)
        } else if (taskLists.isNotEmpty()) {
            // If no current selection, default to first list
            taskListSpinner.setSelection(0)
        }
        dialogView.addView(taskListSpinner)
        
        // Add spacing
        val spacing = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                24
            )
        }
        dialogView.addView(spacing)
        
        // Sort option (placeholder - not implemented)
        val sortLabel = android.widget.TextView(this).apply {
            text = "Sort By"
            textSize = 16f
            setPadding(0, 0, 0, 8)
        }
        dialogView.addView(sortLabel)
        
        val sortSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@WidgetConfigActivity,
                android.R.layout.simple_spinner_item,
                arrayOf("Due Date", "Title", "Created Date")
            ).apply {
                setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            }
        }
        dialogView.addView(sortSpinner)
        
        // Add spacing
        dialogView.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                24
            )
        })
        
        // Theme option (placeholder - not implemented)
        val themeLabel = android.widget.TextView(this).apply {
            text = "Theme"
            textSize = 16f
            setPadding(0, 0, 0, 8)
        }
        dialogView.addView(themeLabel)
        
        val themeSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@WidgetConfigActivity,
                android.R.layout.simple_spinner_item,
                arrayOf("Light", "Dark", "System")
            ).apply {
                setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            }
        }
        dialogView.addView(themeSpinner)
        
        // Add spacing
        dialogView.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                24
            )
        })
        
        // Show completed toggle (placeholder - not implemented)
        val showCompletedCheckbox = CheckBox(this).apply {
            text = "Show Completed Tasks"
            isChecked = false
        }
        dialogView.addView(showCompletedCheckbox)
        
        // Show dialog
        Log.d(TAG, "Showing configuration dialog")
        AlertDialog.Builder(this)
            .setTitle("Widget Configuration")
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                val selectedPosition = taskListSpinner.selectedItemPosition
                Log.d(TAG, "Save clicked, selected position: $selectedPosition")
                if (selectedPosition < taskLists.size) {
                    val selectedList = taskLists[selectedPosition]
                    val selectedListId = selectedList["id"] as? String ?: ""
                    
                    Log.d(TAG, "Saving selected list ID: $selectedListId")
                    
                    // Save selected list
                    prefs.edit().putString(CURRENT_TASKLIST_ID_KEY, selectedListId).apply()
                    
                    // Set result first (required for widget to be created)
                    val resultValue = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    setResult(RESULT_OK, resultValue)
                    
                    // Update widget immediately
                    val appWidgetManager = AppWidgetManager.getInstance(this)
                    val widgetProvider = TasksWidgetProvider()
                    widgetProvider.onUpdate(this, appWidgetManager, intArrayOf(appWidgetId))
                    
                    // Force data refresh to show tasks for new list
                    appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.list_view)
                    
                    Log.d(TAG, "Widget configuration saved, widget updated and data refreshed")
                    finish()
                }
            }
            .setNegativeButton("Cancel") { _, _ -> 
                Log.d(TAG, "Cancel clicked")
                finish() 
            }
            .setOnCancelListener { 
                Log.d(TAG, "Dialog cancelled")
                finish() 
            }
            .show()
    }
}
