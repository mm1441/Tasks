package package_name

import android.content.Context
import com.facebook.react.bridge.*

class WidgetStorageModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "WidgetStorage"

  private val prefsName = "tasks_widget_prefs"

  @ReactMethod
  fun setTasks(json: String) {
    val prefs = reactContext
      .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit().putString("tasks", json).commit()
  }

  @ReactMethod
  fun setTaskLists(json: String) {
    val prefs = reactContext
      .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit().putString("taskLists", json).commit()
  }

  @ReactMethod
  fun setCurrentTaskListId(id: String) {
    val prefs = reactContext
      .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit().putString("currentTaskListId", id).commit()
  }

  @ReactMethod
  fun updateWidget() {
    val ctx = reactContext.applicationContext
    val intent = android.content.Intent("${ctx.packageName}.UPDATE_WIDGET")
    ctx.sendBroadcast(intent)
  }

  /**
   * Atomically writes all widget data and triggers an update. Use this instead of
   * setTasks + setTaskLists + setCurrentTaskListId + updateWidget to guarantee the
   * widget reads the new data (avoids bridge async ordering issues).
   */
  @ReactMethod
  fun setAllAndUpdateWidget(tasksJson: String, taskListsJson: String, currentTaskListId: String) {
    val prefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit()
      .putString("tasks", tasksJson)
      .putString("taskLists", taskListsJson)
      .putString("currentTaskListId", currentTaskListId)
      .commit()
    val ctx = reactContext.applicationContext
    val intent = android.content.Intent("${ctx.packageName}.UPDATE_WIDGET")
    ctx.sendBroadcast(intent)
  }

  @ReactMethod
  fun getTasks(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      val tasksJson = prefs.getString("tasks", "[]") ?: "[]"
      promise.resolve(tasksJson)
    } catch (e: Exception) {
      promise.reject("GET_TASKS_ERROR", "Failed to get tasks from SharedPreferences", e)
    }
  }

  @ReactMethod
  fun getCurrentTaskListId(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
      val currentTaskListId = prefs.getString("currentTaskListId", "") ?: ""
      promise.resolve(currentTaskListId)
    } catch (e: Exception) {
      promise.reject("GET_CURRENT_TASKLIST_ID_ERROR", "Failed to get currentTaskListId from SharedPreferences", e)
    }
  }
}
