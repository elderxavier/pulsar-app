package com.pulsar.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val PulsarColorScheme = darkColorScheme(
    primary = PulsarCyan,
    background = PulsarBackground,
    surface = PulsarSurface,
    onPrimary = PulsarBackground,
    onBackground = PulsarOnSurface,
    onSurface = PulsarOnSurface,
    error = PulsarError,
)

@Composable
fun PulsarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PulsarColorScheme,
        content = content,
    )
}
