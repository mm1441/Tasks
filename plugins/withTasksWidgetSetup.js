const path = require("path");
const fs = require("fs").promises;
const {
  withAndroidManifest,
  withMainApplication,
  withAndroidStyles,
} = require("@expo/config-plugins");
const { getMainApplicationOrThrow } = require("@expo/config-plugins/build/android/Manifest");

/** Recursively replace "package_name" with actual package in .kt files (fixes deep link / home URIs). */
async function replacePackageNameInKotlinRecursive(dir, packageName) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      await replacePackageNameInKotlinRecursive(fullPath, packageName);
    } else if (e.name.endsWith(".kt")) {
      let content = await fs.readFile(fullPath, "utf8");
      if (content.includes("package_name")) {
        content = content.replace(/package_name/g, packageName);
        await fs.writeFile(fullPath, content);
      }
    }
  }
}

/**
 * Expo config plugin that applies the required Android changes for the tasks widget:
 * - AndroidManifest: full receiver intent-filters, TaskListService, WidgetConfigActivity, AddTaskActivity
 * - MainApplication.kt: WidgetStoragePackage import and add()
 * - styles.xml: Theme.AddTaskActivity
 * - res/xml/tasks_widget_info.xml: replace package_name placeholder with actual package
 */
function withTasksWidgetSetup(config) {
  const packageName = config.android?.package ?? "com.magicmarinac.tasks";

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = getMainApplicationOrThrow(manifest);

    // Ensure receiver array exists
    if (!application.receiver) {
      application.receiver = [];
    }

    // Find or create TasksWidgetProvider receiver
    let receiver = application.receiver.find(
      (r) => r.$["android:name"] === ".TasksWidgetProvider"
    );
    if (!receiver) {
      receiver = {
        $: {
          "android:name": ".TasksWidgetProvider",
          "android:exported": "true",
        },
        "intent-filter": [],
        "meta-data": [],
      };
      application.receiver.push(receiver);
    }

    // Override android:exported to true (widget plugin may set it to false; widget must receive UPDATE_WIDGET, TOGGLE_TASK, OPEN_TASK)
    receiver.$["android:exported"] = "true";

    // Ensure receiver has all four intent-filters
    const requiredActions = [
      "android.appwidget.action.APPWIDGET_UPDATE",
      `${packageName}.UPDATE_WIDGET`,
      `${packageName}.TOGGLE_TASK`,
      `${packageName}.OPEN_TASK`,
    ];
    const existingActions = new Set(
      (receiver["intent-filter"] || []).flatMap(
        (f) => (f.action || []).map((a) => a.$["android:name"])
      )
    );
    for (const action of requiredActions) {
      if (!existingActions.has(action)) {
        if (!receiver["intent-filter"]) receiver["intent-filter"] = [];
        receiver["intent-filter"].push({
          action: [{ $: { "android:name": action } }],
        });
        existingActions.add(action);
      }
    }

    // Ensure appwidget.provider meta-data
    if (!receiver["meta-data"]) receiver["meta-data"] = [];
    const providerMeta = receiver["meta-data"].find(
      (m) => m.$["android:name"] === "android.appwidget.provider"
    );
    if (!providerMeta) {
      receiver["meta-data"].push({
        $: {
          "android:name": "android.appwidget.provider",
          "android:resource": "@xml/tasks_widget_info",
        },
      });
    }

    // Ensure TaskListService exists
    if (!application.service) application.service = [];
    if (!application.service.some((s) => s.$["android:name"] === ".TaskListService")) {
      application.service.push({
        $: {
          "android:name": ".TaskListService",
          "android:permission": "android.permission.BIND_REMOTEVIEWS",
          "android:exported": "false",
        },
      });
    }

    // Ensure WidgetConfigActivity exists
    if (!application.activity) application.activity = [];
    if (!application.activity.some((a) => a.$["android:name"] === ".WidgetConfigActivity")) {
      application.activity.push({
        $: {
          "android:name": ".WidgetConfigActivity",
          "android:exported": "true",
          "android:theme": "@android:style/Theme.Material.Light.Dialog",
          "android:launchMode": "singleTop",
          "android:excludeFromRecents": "true",
          "android:taskAffinity": "",
        },
      });
    }

    // Ensure AddTaskActivity exists
    if (!application.activity.some((a) => a.$["android:name"] === ".AddTaskActivity")) {
      application.activity.push({
        $: {
          "android:name": ".AddTaskActivity",
          "android:exported": "true",
          "android:theme": "@style/Theme.AddTaskActivity",
          "android:windowSoftInputMode": "stateVisible|adjustResize",
          "android:launchMode": "singleTop",
          "android:excludeFromRecents": "true",
          "android:taskAffinity": "",
        },
      });
    }

    return config;
  });

  config = withMainApplication(config, (config) => {
    const { contents } = config.modResults;
    let newContents = contents;
    const importLine = `import ${packageName}.WidgetStoragePackage`;
    const addLine = `add(WidgetStoragePackage())`;

    if (!contents.includes(importLine)) {
      // Add import after the last import (before class)
      const lastImportMatch = contents.match(/import\s+[\w.]+\s*\n/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertIndex = contents.indexOf(lastImport) + lastImport.length;
        newContents =
          newContents.slice(0, insertIndex) +
          importLine +
          "\n" +
          newContents.slice(insertIndex);
      }
    }

    if (!newContents.includes(addLine)) {
      // Add add(WidgetStoragePackage()) inside getPackages() apply block
      const applyMatch = newContents.match(
        /PackageList\(this\)\.packages\.apply\s*\{\s*\n/
      );
      if (applyMatch) {
        const insertIndex =
          newContents.indexOf(applyMatch[0]) + applyMatch[0].length;
        newContents =
          newContents.slice(0, insertIndex) +
          "              add(WidgetStoragePackage())\n              " +
          newContents.slice(insertIndex);
      }
    }

    config.modResults.contents = newContents;
    return config;
  });

  config = withAndroidStyles(config, async (config) => {
    const styles = config.modResults;
    if (!styles.resources) styles.resources = {};
    if (!Array.isArray(styles.resources.style)) {
      styles.resources.style = [];
    }

    const themeName = "Theme.AddTaskActivity";
    const hasTheme = styles.resources.style.some(
      (s) => s.$ && s.$.name === themeName
    );
    if (!hasTheme) {
      styles.resources.style.push({
        $: {
          name: themeName,
          parent: "Theme.AppCompat.DayNight.NoActionBar",
        },
        item: [
          { $: { name: "android:windowBackground" }, _: "@android:color/transparent" },
          { $: { name: "android:windowIsTranslucent" }, _: "true" },
          { $: { name: "android:windowNoTitle" }, _: "true" },
          { $: { name: "android:backgroundDimEnabled" }, _: "false" },
          { $: { name: "android:windowSoftInputMode" }, _: "adjustResize" },
        ],
      });
    }

    // Replace package_name in tasks_widget_info.xml and in Kotlin string literals (widget plugin only replaces package/imports, not URIs)
    const projectRoot = config.modRequest?.projectRoot;
    const androidRoot =
      config.modRequest?.platformProjectRoot ||
      (projectRoot ? path.join(projectRoot, "android") : null);
    if (androidRoot) {
      const xmlPath = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
        "tasks_widget_info.xml"
      );
      try {
        let content = await fs.readFile(xmlPath, "utf8");
        if (content.includes("package_name")) {
          content = content.replace(/package_name/g, packageName);
          await fs.writeFile(xmlPath, content);
        }
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }

      // Replace package_name in Kotlin files (deep link and home URIs) so intent-filters match
      const javaRoot = path.join(androidRoot, "app", "src", "main", "java");
      try {
        await replacePackageNameInKotlinRecursive(javaRoot, packageName);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    }

    return config;
  });

  return config;
}

module.exports = withTasksWidgetSetup;
