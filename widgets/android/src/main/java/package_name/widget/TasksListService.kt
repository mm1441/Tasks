package package_name.widget

import android.content.Intent
import android.widget.RemoteViewsService

class TaskListService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return TaskRemoteViewsFactory(applicationContext, intent)
    }
}