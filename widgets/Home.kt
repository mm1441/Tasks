package com.magicmarinac.tasks.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.components.Scaffold
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.padding
import androidx.glance.preview.ExperimentalGlancePreviewApi
import androidx.glance.preview.Preview
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

class Home : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {

        // In this method, load data needed to render the AppWidget.
        // Use withContext to switch to another thread for long running
        // operations.

        provideContent {
            GlanceTheme {
                HomeContent()
            }
        }
    }
}

@Composable
private fun HomeContent() {
    Scaffold(
        backgroundColor = GlanceTheme.colors.widgetBackground, 
        modifier = GlanceModifier.padding(16.dp)
    ) {
        Text(
            "Hello Widget", 
            style = TextStyle(color = GlanceTheme.colors.onSurface)
        )
    }
}

@OptIn(ExperimentalGlancePreviewApi::class)
@Preview(widthDp = 180, heightDp = 304)
@Composable
fun HomeWidgetContentPreview() {
    HomeContent()
}
