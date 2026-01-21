class WidgetModule : Module(appContext) {
    override fun definition() = ModuleDefinition {
        Function("updateWidget") {
            val intent = Intent("com.example.tasksapp.UPDATE_WIDGET")
            intent.component = ComponentName(appContext.reactContext!!, "com.example.tasksapp.widget.TasksWidgetProvider")
            appContext.reactContext!!.sendBroadcast(intent)
        }
    }
}