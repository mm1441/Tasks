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
    prefs.edit().putString("tasks", json).apply()
  }

  @ReactMethod
  fun setTaskLists(json: String) {
    val prefs = reactContext
      .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit().putString("taskLists", json).apply()
  }

  @ReactMethod
  fun setCurrentTaskListId(id: String) {
    val prefs = reactContext
      .getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    prefs.edit().putString("currentTaskListId", id).apply()
  }

  @ReactMethod
  fun updateWidget() {
    val ctx = reactContext.applicationContext
    val intent = android.content.Intent("${ctx.packageName}.UPDATE_WIDGET")
    ctx.sendBroadcast(intent)
  }
}
