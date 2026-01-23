package package_name

import android.app.Activity
import android.app.DatePickerDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKS_KEY = "tasks"
private const val CURRENT_TASKLIST_ID_KEY = "currentTaskListId"
private const val TAG = "AddTaskActivity"

class AddTaskActivity : Activity() {
    private var selectedDueDate: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Configure window for bottom dialog
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setGravity(Gravity.BOTTOM)
        window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT)
        window.setBackgroundDrawableResource(android.R.color.transparent)
        
        // Create bottom-anchored dialog layout
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 24, 24, 24)
            setBackgroundColor(android.graphics.Color.WHITE)
            elevation = 8f
        }
        
        // Title
        val titleView = android.widget.TextView(this).apply {
            text = "New Task"
            textSize = 20f
            setPadding(0, 0, 0, 16)
            setTextColor(android.graphics.Color.BLACK)
        }
        rootLayout.addView(titleView)
        
        // Task title input
        val titleInput = EditText(this).apply {
            hint = "Task title"
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 16
            }
        }
        rootLayout.addView(titleInput)
        
        // Description input (initially hidden)
        val descriptionInput = EditText(this).apply {
            hint = "Description (optional)"
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 16
            }
            minLines = 3
            maxLines = 5
        }
        rootLayout.addView(descriptionInput)
        
        // Due date display (initially hidden)
        val dueDateLabel = TextView(this).apply {
            text = ""
            visibility = View.GONE
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#007AFF"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 16
            }
            setPadding(0, 8, 0, 8)
        }
        rootLayout.addView(dueDateLabel)
        
        // Action buttons row
        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.END
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = 16
            }
        }
        
        // Description icon button
        val descriptionButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_edit)
            background = null
            contentDescription = "Add description"
            layoutParams = LinearLayout.LayoutParams(
                48,
                48
            )
            setOnClickListener {
                if (descriptionInput.visibility == View.GONE) {
                    descriptionInput.visibility = View.VISIBLE
                    descriptionInput.requestFocus()
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                    imm.showSoftInput(descriptionInput, InputMethodManager.SHOW_IMPLICIT)
                } else {
                    descriptionInput.visibility = View.GONE
                }
            }
        }
        buttonRow.addView(descriptionButton)
        
        // Due date icon button - opens DatePickerDialog immediately
        val dueDateButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_my_calendar)
            background = null
            contentDescription = "Add due date"
            layoutParams = LinearLayout.LayoutParams(
                48,
                48
            )
            setOnClickListener {
                showDatePicker(dueDateLabel)
            }
        }
        buttonRow.addView(dueDateButton)
        
        rootLayout.addView(buttonRow)
        
        // Save button
        val saveButton = Button(this).apply {
            text = "Save"
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                val title = titleInput.text.toString().trim()
                if (title.isNotEmpty()) {
                    saveTask(title, descriptionInput.text.toString(), selectedDueDate)
                    finish()
                }
            }
        }
        rootLayout.addView(saveButton)
        
        setContentView(rootLayout)
        
        // Show keyboard automatically
        titleInput.requestFocus()
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        
        // Show keyboard programmatically after a short delay
        titleInput.post {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(titleInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }
    
    private fun showDatePicker(dueDateLabel: TextView) {
        val calendar = Calendar.getInstance()
        
        val datePickerDialog = DatePickerDialog(
            this,
            { _, year, month, dayOfMonth ->
                // Format date as ISO string for storage
                val selectedCalendar = Calendar.getInstance()
                selectedCalendar.set(year, month, dayOfMonth, 23, 59, 59)
                
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                selectedDueDate = isoFormat.format(selectedCalendar.time)
                
                // Display formatted date
                val displayFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                dueDateLabel.text = "Due: ${displayFormat.format(selectedCalendar.time)}"
                dueDateLabel.visibility = View.VISIBLE
                
                Log.d(TAG, "Selected due date: $selectedDueDate")
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        )
        
        // Set minimum date to today
        datePickerDialog.datePicker.minDate = System.currentTimeMillis() - 1000
        datePickerDialog.show()
    }
    
    private fun saveTask(title: String, description: String, dueDate: String) {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
            
            // Load existing tasks
            val tasksJson = prefs.getString(TASKS_KEY, "[]") ?: "[]"
            val gson = Gson()
            val type = object : TypeToken<MutableList<MutableMap<String, Any>>>() {}.type
            val tasks = gson.fromJson<MutableList<MutableMap<String, Any>>>(tasksJson, type) ?: mutableListOf()
            
            // Create new task with all required fields
            val now = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val newTask = mutableMapOf<String, Any>(
                "id" to java.util.UUID.randomUUID().toString(),
                "title" to title,
                "isCompleted" to false,
                "tasklistId" to currentTaskListId,
                "createdAt" to now,
                "lastModified" to now,
                "isDeleted" to false
            )
            if (description.isNotEmpty()) {
                newTask["description"] = description
            }
            if (dueDate.isNotEmpty()) {
                newTask["dueDate"] = dueDate
            }
            
            // Add task to list
            tasks.add(newTask)
            
            // Save back to SharedPreferences - use commit() for synchronous write to ensure data is persisted
            val updatedJson = gson.toJson(tasks)
            val saved = prefs.edit().putString(TASKS_KEY, updatedJson).commit()
            
            Log.d(TAG, "Task saved to SharedPreferences: $title (saved=$saved)")
            
            // Update widget immediately using the same approach as WidgetConfigActivity
            val appWidgetManager = AppWidgetManager.getInstance(this)
            val componentName = ComponentName(this, TasksWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            
            if (appWidgetIds.isNotEmpty()) {
                Log.d(TAG, "Updating ${appWidgetIds.size} widget(s) directly")
                val widgetProvider = TasksWidgetProvider()
                // Update widget UI first
                widgetProvider.onUpdate(this, appWidgetManager, appWidgetIds)
                // Then force data refresh to reload tasks from SharedPreferences
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
                Log.d(TAG, "Widget(s) updated and data refreshed")
            } else {
                Log.d(TAG, "No widgets found, sending broadcast as fallback")
                // Fallback to broadcast if no widgets found
                val updateIntent = Intent("${packageName}.UPDATE_WIDGET")
                sendBroadcast(updateIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error saving task", e)
        }
    }
    
    override fun finish() {
        // Hide keyboard
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        val view = currentFocus
        if (view != null) {
            imm.hideSoftInputFromWindow(view.windowToken, 0)
        }
        super.finish()
    }
}
