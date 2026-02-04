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
private const val SHOW_COMPLETED_KEY = "showCompleted"
private const val THEME_KEY = "theme"
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
        val taskListAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, listNames)
        taskListAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        taskListSpinner.adapter = taskListAdapter
        
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
        
        // Theme option (placeholder - not implemented)
        val themeLabel = android.widget.TextView(this).apply {
            text = "Theme"
            textSize = 16f
            setPadding(0, 0, 0, 8)
        }
        dialogView.addView(themeLabel)
        
        // Load current theme preference (default: "Light")
        val currentTheme = prefs.getString(THEME_KEY, "Light") ?: "Light"
        val themeSpinner = Spinner(this)
        val themeOptions = arrayOf("Light", "Dark")
        val themeAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            themeOptions
        )
        themeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        themeSpinner.adapter = themeAdapter
        
        // Set current selection (default to "Light" which is index 0)
        val selectedIndex = if (currentTheme == "Dark") 1 else 0
        themeSpinner.setSelection(selectedIndex)
        Log.d(TAG, "Theme spinner initialized with selection: $selectedIndex (theme: $currentTheme)")
        
        dialogView.addView(themeSpinner)
        
        // Add spacing
        dialogView.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                24
            )
        })
        
        // Show completed toggle
        val showCompleted = prefs.getBoolean(SHOW_COMPLETED_KEY, false)
        val showCompletedCheckbox = CheckBox(this).apply {
            text = "Show Completed Tasks"
            isChecked = showCompleted
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
                    
                    // Get selected theme (should never be null since we have items, but safe cast anyway)
                    val selectedTheme = (themeSpinner.selectedItem as? String) ?: "Light"
                    Log.d(TAG, "Selected theme from spinner: $selectedTheme")
                    
                    // Save selected list, show completed setting, and theme
                    prefs.edit()
                        .putString(CURRENT_TASKLIST_ID_KEY, selectedListId)
                        .putBoolean(SHOW_COMPLETED_KEY, showCompletedCheckbox.isChecked)
                        .putString(THEME_KEY, selectedTheme)
                        .apply()
                    
                    Log.d(TAG, "Theme saved: $selectedTheme")
                    
                    Log.d(TAG, "Show completed: ${showCompletedCheckbox.isChecked}")
                    
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
