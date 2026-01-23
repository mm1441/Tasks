package package_name

import android.content.Intent
import android.util.Log
import android.widget.RemoteViewsService

class TaskListService : RemoteViewsService() {
    private val TAG = "TasksWidget"
    
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        Log.d(TAG, "TaskListService.onGetViewFactory() called")
        return TaskRemoteViewsFactory(applicationContext, intent)
    }
}