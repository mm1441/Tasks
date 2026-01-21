package package_name

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken


private const val APP_GROUP_IDENTIFIER = "group.com.magicmarinac.tasks.widgets"
private const val PREFS_NAME = "tasks_widget_prefs"
private const val TASKS_KEY = "tasks"

class TaskRemoteViewsFactory(private val context: Context, intent: Intent) : RemoteViewsService.RemoteViewsFactory {
    private var tasks: List<Map<String, Any>> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(TASKS_KEY, "[]")

        Log.d("TasksWidget", "json=$json")

        val type = object : TypeToken<List<Map<String, Any>>>() {}.type
        tasks = Gson().fromJson(json, type) ?: emptyList()
    }

    override fun onDestroy() {
        tasks = emptyList()
    }

    override fun getCount(): Int = tasks.size

    override fun getViewAt(position: Int): RemoteViews {
        val rv = RemoteViews(context.packageName, R.layout.task_item)
        rv.setTextViewText(R.id.task_title, tasks[position]["title"] as? String ?: "")
        return rv
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = position.toLong()

    override fun hasStableIds(): Boolean = true
}
