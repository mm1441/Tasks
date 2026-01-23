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
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log
import android.util.TypedValue
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.ViewTreeObserver
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
    private var descriptionInput: EditText? = null
    private var dueDateLabel: TextView? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        
        window.apply {
            setBackgroundDrawableResource(android.R.color.transparent)
            clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
            setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or 
                           WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
        
        val darkGray = Color.parseColor("#3C3C3C")
        val hintColor = Color.parseColor("#9E9E9E")
        val accentBlue = Color.parseColor("#8AB4F8")
        
        val backgroundDrawable = GradientDrawable().apply {
            setColor(darkGray)
            cornerRadii = floatArrayOf(
                dpToPx(12).toFloat(), dpToPx(12).toFloat(),
                dpToPx(12).toFloat(), dpToPx(12).toFloat(),
                0f, 0f, 0f, 0f
            )
        }
        
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
            gravity = Gravity.BOTTOM
            setBackgroundColor(Color.TRANSPARENT)
            isClickable = true
            setOnClickListener { finish() }
        }
        
        val contentLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpToPx(16), dpToPx(16), dpToPx(16), dpToPx(16))
            background = backgroundDrawable
            isClickable = true
        }
        
        val titleInput = EditText(this).apply {
            hint = "New task"
            setHintTextColor(hintColor)
            setTextColor(Color.WHITE)
            textSize = 16f
            background = null
            setPadding(0, 0, 0, dpToPx(8))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        contentLayout.addView(titleInput)
        
        descriptionInput = EditText(this).apply {
            hint = "Add description"
            setHintTextColor(hintColor)
            setTextColor(Color.WHITE)
            textSize = 14f
            background = null
            visibility = View.GONE
            minLines = 1
            maxLines = 4
            setPadding(0, dpToPx(4), 0, dpToPx(8))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        contentLayout.addView(descriptionInput)
        
        dueDateLabel = TextView(this).apply {
            text = ""
            visibility = View.GONE
            textSize = 14f
            setTextColor(accentBlue)
            setPadding(0, dpToPx(4), 0, dpToPx(8))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        contentLayout.addView(dueDateLabel)
        
        val bottomRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dpToPx(8)
            }
        }
        
        val iconsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
            )
        }
        
        val detailsButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_sort_by_size)
            setColorFilter(hintColor)
            background = null
            contentDescription = "Add description"
            layoutParams = LinearLayout.LayoutParams(dpToPx(40), dpToPx(40))
            setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
            setOnClickListener {
                if (descriptionInput?.visibility == View.GONE) {
                    descriptionInput?.visibility = View.VISIBLE
                    descriptionInput?.requestFocus()
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                    imm.showSoftInput(descriptionInput, InputMethodManager.SHOW_IMPLICIT)
                } else {
                    descriptionInput?.visibility = View.GONE
                    titleInput.requestFocus()
                }
            }
        }
        iconsContainer.addView(detailsButton)
        
        val calendarButton = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_my_calendar)
            setColorFilter(hintColor)
            background = null
            contentDescription = "Add due date"
            layoutParams = LinearLayout.LayoutParams(dpToPx(40), dpToPx(40))
            setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
            setOnClickListener {
                showDatePicker()
            }
        }
        iconsContainer.addView(calendarButton)
        
        bottomRow.addView(iconsContainer)
        
        val saveButton = TextView(this).apply {
            text = "Save"
            setTextColor(hintColor)
            textSize = 14f
            setPadding(dpToPx(16), dpToPx(8), dpToPx(8), dpToPx(8))
            setOnClickListener {
                val title = titleInput.text.toString().trim()
                if (title.isNotEmpty()) {
                    saveTask(title, descriptionInput?.text?.toString() ?: "", selectedDueDate)
                    finish()
                }
            }
        }
        bottomRow.addView(saveButton)
        
        contentLayout.addView(bottomRow)
        rootLayout.addView(contentLayout)
        
        setContentView(rootLayout)
        
        titleInput.requestFocus()
        titleInput.post {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(titleInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }
    
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
    
    private fun showDatePicker() {
        val calendar = Calendar.getInstance()
        
        val datePickerDialog = DatePickerDialog(
            this,
            { _, year, month, dayOfMonth ->
                val selectedCalendar = Calendar.getInstance()
                selectedCalendar.set(year, month, dayOfMonth, 23, 59, 59)
                
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                selectedDueDate = isoFormat.format(selectedCalendar.time)
                
                val displayFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                dueDateLabel?.text = "Due: ${displayFormat.format(selectedCalendar.time)}"
                dueDateLabel?.visibility = View.VISIBLE
                
                Log.d(TAG, "Selected due date: $selectedDueDate")
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        )
        
        datePickerDialog.datePicker.minDate = System.currentTimeMillis() - 1000
        datePickerDialog.show()
    }
    
    private fun saveTask(title: String, description: String, dueDate: String) {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentTaskListId = prefs.getString(CURRENT_TASKLIST_ID_KEY, "") ?: ""
            
            val tasksJson = prefs.getString(TASKS_KEY, "[]") ?: "[]"
            val gson = Gson()
            val type = object : TypeToken<MutableList<MutableMap<String, Any>>>() {}.type
            val tasks = gson.fromJson<MutableList<MutableMap<String, Any>>>(tasksJson, type) ?: mutableListOf()
            
            val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(java.util.Date())
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
            
            tasks.add(newTask)
            
            val updatedJson = gson.toJson(tasks)
            val saved = prefs.edit().putString(TASKS_KEY, updatedJson).commit()
            
            Log.d(TAG, "Task saved: $title (saved=$saved)")
            
            val appWidgetManager = AppWidgetManager.getInstance(this)
            val componentName = ComponentName(this, TasksWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            
            if (appWidgetIds.isNotEmpty()) {
                Log.d(TAG, "Updating ${appWidgetIds.size} widget(s)")
                val widgetProvider = TasksWidgetProvider()
                widgetProvider.onUpdate(this, appWidgetManager, appWidgetIds)
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.list_view)
            } else {
                val updateIntent = Intent("${packageName}.UPDATE_WIDGET")
                sendBroadcast(updateIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error saving task", e)
        }
    }
    
    override fun finish() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        currentFocus?.let { imm.hideSoftInputFromWindow(it.windowToken, 0) }
        super.finish()
    }
}
