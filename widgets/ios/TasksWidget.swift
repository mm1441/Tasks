import WidgetKit
import SwiftUI

struct Task: Codable {
    let id: String
    let title: String
    let dueDate: String?
    let isCompleted: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), tasks: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), tasks: [])
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let sharedDefaults = UserDefaults(suiteName: APP_GROUP_IDENTIFIER)
        var tasks: [Task] = []
        if let data = sharedDefaults?.data(forKey: "tasks") {
            tasks = (try? JSONDecoder().decode([Task].self, from: data)) ?? []
        }
        let entry = SimpleEntry(date: Date(), tasks: tasks)
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(300)))  // Refresh every 5 min
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let tasks: [Task]
}

struct TasksWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading) {
            Text("Tasks")
                .font(.headline)
            if entry.tasks.isEmpty {
                Text("No tasks")
            } else {
                ForEach(entry.tasks, id: \.id) { task in
                    Text(task.title)
                        .font(.subheadline)
                }
            }
        }
        .padding()
    }
}

@main
struct TasksWidget: Widget {
    let kind: String = "TasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TasksWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Tasks Widget")
        .description("Displays tasks from selected list.")
        .supportedFamilies([.systemSmall, .systemMedium])  // Adjust sizes
    }
}