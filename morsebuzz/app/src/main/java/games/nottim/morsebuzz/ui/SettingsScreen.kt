package games.nottim.morsebuzz.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import games.nottim.morsebuzz.data.AppState
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.morse.MorseEncoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SettingsScreen(
    state: AppState,
    hasAmplitudeControl: Boolean,
    preview: (String) -> Unit,
    store: MappingStore,
    scope: CoroutineScope,
) {
    val context = LocalContext.current
    val settings = state.settings
    var showAppPicker by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        TryItCard(preview = preview, state = state)

        SectionLabel("Feel")

        var dit by remember(settings.ditMs) { mutableFloatStateOf(settings.ditMs.toFloat()) }
        SliderRow(
            label = "Dit length — ${dit.toInt()} ms",
            value = dit,
            range = 80f..250f,
            onChange = { dit = it },
            onDone = {
                scope.launch { store.setDitMs(dit.toLong()) }
                preview("A")
            },
        )

        ToggleRow(
            title = "Soft dits, strong dahs",
            subtitle = if (hasAmplitudeControl) {
                "Amplitude contrast makes them much easier to tell apart"
            } else {
                "Not supported by this device's vibration motor"
            },
            checked = settings.amplitudeMode && hasAmplitudeControl,
            enabled = hasAmplitudeControl,
        ) { scope.launch { store.setAmplitudeMode(it) } }

        var maxChars by remember(settings.maxChars) {
            mutableFloatStateOf(settings.maxChars.toFloat())
        }
        SliderRow(
            label = "Max characters — ${maxChars.toInt()}",
            value = maxChars,
            range = 1f..4f,
            steps = 2,
            onChange = { maxChars = it },
            onDone = { scope.launch { store.setMaxChars(maxChars.toInt()) } },
        )

        var budget by remember(settings.budgetMs) {
            mutableFloatStateOf(settings.budgetMs.toFloat())
        }
        SliderRow(
            label = "Max buzz length — %.1f s".format(budget / 1000f),
            value = budget,
            range = 2000f..6000f,
            onChange = { budget = it },
            onDone = { scope.launch { store.setBudgetMs(budget.toLong()) } },
        )

        SectionLabel("Behavior")

        var debounce by remember(settings.debounceSeconds) {
            mutableFloatStateOf(settings.debounceSeconds.toFloat())
        }
        SliderRow(
            label = "Quiet window per sender — ${debounce.toInt()} s",
            value = debounce,
            range = 5f..60f,
            onChange = { debounce = it },
            onDone = { scope.launch { store.setDebounceSeconds(debounce.toInt()) } },
        )

        ToggleRow(
            title = "Skip when screen is on",
            subtitle = "If you're already looking at an unlocked phone, stay quiet",
            checked = settings.skipWhenScreenOn,
        ) { scope.launch { store.setSkipWhenScreenOn(it) } }

        ToggleRow(
            title = "Single dit for unknown senders",
            subtitle = "Off means unknown senders stay silent",
            checked = settings.unknownSenderDit,
        ) { scope.launch { store.setUnknownSenderDit(it) } }

        SectionLabel("Source apps")

        Text(
            "MorseBuzz only reacts to these apps. Tap Silence to open an app's " +
                "notification settings and turn its own vibration off — otherwise " +
                "you'll feel its generic buzz before the Morse.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        settings.allowedPackages.sorted().forEach { pkg ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(appLabel(context, pkg), style = MaterialTheme.typography.bodyLarge)
                    Text(
                        pkg,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TextButton(onClick = { openAppNotificationSettings(context, pkg) }) {
                    Text("Silence")
                }
                IconButton(onClick = {
                    scope.launch { store.setPackageAllowed(pkg, false) }
                }) {
                    Icon(Icons.Default.Close, contentDescription = "Remove $pkg")
                }
            }
        }
        if (settings.allowedPackages.isEmpty()) {
            Text(
                "No source apps yet — add your messaging apps below.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Button(onClick = { showAppPicker = true }) { Text("Add app") }

        HorizontalDivider()
        Text(
            "MorseBuzz vibrates as a notification, so Do Not Disturb silences it too.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
    }

    if (showAppPicker) {
        AppPickerDialog(
            exclude = settings.allowedPackages,
            onPick = { pkg ->
                scope.launch { store.setPackageAllowed(pkg, true) }
                showAppPicker = false
            },
            onDismiss = { showAppPicker = false },
        )
    }
}

@Composable
private fun TryItCard(preview: (String) -> Unit, state: AppState) {
    var text by remember { mutableStateOf("") }
    Card {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Feel any text", style = MaterialTheme.typography.titleMedium)
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    placeholder = { Text("MR") },
                    singleLine = true,
                    supportingText = {
                        Text(
                            MorseEncoder.glyphs(text).ifEmpty { " " },
                            fontFamily = FontFamily.Monospace,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(12.dp))
                Button(onClick = { preview(text) }, enabled = text.isNotBlank()) {
                    Text("Buzz")
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun SliderRow(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onChange: (Float) -> Unit,
    onDone: () -> Unit,
    steps: Int = 0,
) {
    Column {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Slider(
            value = value,
            onValueChange = onChange,
            valueRange = range,
            steps = steps,
            onValueChangeFinished = onDone,
        )
    }
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean = true,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun AppPickerDialog(
    exclude: Set<String>,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    var query by remember { mutableStateOf("") }
    val apps by produceState(initialValue = emptyList<Pair<String, String>>()) {
        value = withContext(Dispatchers.IO) { launchableApps(context) }
    }
    val filtered = apps.filter { (pkg, label) ->
        pkg !in exclude && pkg != context.packageName &&
            (query.isBlank() || label.contains(query, ignoreCase = true))
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add source app") },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("Search") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                LazyColumn(Modifier.height(320.dp)) {
                    items(filtered, key = { it.first }) { (pkg, label) ->
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                        ) {
                            TextButton(
                                onClick = { onPick(pkg) },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(Modifier.fillMaxWidth()) {
                                    Text(label, style = MaterialTheme.typography.bodyLarge)
                                    Text(
                                        pkg,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        },
    )
}

private fun launchableApps(context: Context): List<Pair<String, String>> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    return pm.queryIntentActivities(intent, 0)
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
}

private fun appLabel(context: Context, packageName: String): String = try {
    val pm = context.packageManager
    pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
} catch (_: Exception) {
    packageName
}

private fun openAppNotificationSettings(context: Context, packageName: String) {
    val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
    try {
        context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        // Some OEM builds lack this screen; nothing sensible to do.
    }
}
