package games.nottim.morsebuzz.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Deliberate signal-amber accent; no dynamic Material You colors.
private val LightColors = lightColorScheme(
    primary = Color(0xFF8F4C00),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFFDCC2),
    onPrimaryContainer = Color(0xFF2E1500),
    secondary = Color(0xFF745943),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFFFDCC2),
    onSecondaryContainer = Color(0xFF2A1707),
    background = Color(0xFFFFF8F4),
    onBackground = Color(0xFF221A13),
    surface = Color(0xFFFFF8F4),
    onSurface = Color(0xFF221A13),
    surfaceVariant = Color(0xFFF3DFD1),
    onSurfaceVariant = Color(0xFF52443A),
    error = Color(0xFFBA1A1A),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFFFB77C),
    onPrimary = Color(0xFF4C2700),
    primaryContainer = Color(0xFF6D3A00),
    onPrimaryContainer = Color(0xFFFFDCC2),
    secondary = Color(0xFFE3C0A5),
    onSecondary = Color(0xFF412C19),
    secondaryContainer = Color(0xFF5A422D),
    onSecondaryContainer = Color(0xFFFFDCC2),
    background = Color(0xFF19120C),
    onBackground = Color(0xFFEFE0D5),
    surface = Color(0xFF19120C),
    onSurface = Color(0xFFEFE0D5),
    surfaceVariant = Color(0xFF52443A),
    onSurfaceVariant = Color(0xFFD7C3B5),
    error = Color(0xFFFFB4AB),
)

@Composable
fun MorseBuzzTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
