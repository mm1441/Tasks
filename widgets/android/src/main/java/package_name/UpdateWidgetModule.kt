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
