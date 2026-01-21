package package_name

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.content.Intent

class UpdateWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "UpdateWidget"

  @ReactMethod
  fun updateWidget() {
    val ctx = reactApplicationContext.applicationContext
    val action = "${ctx.packageName}.UPDATE_WIDGET"
    val intent = Intent(action)
    ctx.sendBroadcast(intent)
  }
}
package package_name

import android.content.Context
import com.facebook.react.bridge.*

class WidgetStorageModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "WidgetStorage"

  @ReactMethod
  fun setTasks(json: String) {
    val prefs = reactContext
      .getSharedPreferences("tasks_widget_prefs", Context.MODE_PRIVATE)

    prefs.edit().putString("tasks", json).apply()
  }

  @ReactMethod
  fun updateWidget() {
    val ctx = reactContext.applicationContext
    val intent = android.content.Intent("${ctx.packageName}.UPDATE_WIDGET")
    ctx.sendBroadcast(intent)
  }
}
