package games.nottim.morsebuzz.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import games.nottim.morsebuzz.data.AppState
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.vibe.Buzzer
import kotlinx.coroutines.delay

@Composable
fun MorseBuzzApp(store: MappingStore, buzzer: Buzzer) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by store.state.collectAsState(initial = AppState())
    var tab by rememberSaveable { mutableIntStateOf(0) }

    // The notification-listener grant happens in system settings, so poll it.
    var listenerEnabled by remember { mutableStateOf(isListenerEnabled(context)) }
    var contactsGranted by remember { mutableStateOf(hasContactsPermission(context)) }
    LaunchedEffect(Unit) {
        while (true) {
            listenerEnabled = isListenerEnabled(context)
            contactsGranted = hasContactsPermission(context)
            delay(2_000)
        }
    }

    val preview: (String) -> Unit = { text -> buzzer.buzz(text, state.settings) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("Senders") },
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("Settings") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                0 -> SendersScreen(
                    state = state,
                    listenerEnabled = listenerEnabled,
                    contactsGranted = contactsGranted,
                    preview = preview,
                    store = store,
                    scope = scope,
                )
                else -> SettingsScreen(
                    state = state,
                    hasAmplitudeControl = buzzer.hasAmplitudeControl,
                    preview = preview,
                    store = store,
                    scope = scope,
                )
            }
        }
    }
}

fun isListenerEnabled(context: Context): Boolean =
    NotificationManagerCompat.getEnabledListenerPackages(context)
        .contains(context.packageName)

fun hasContactsPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) ==
        PackageManager.PERMISSION_GRANTED
