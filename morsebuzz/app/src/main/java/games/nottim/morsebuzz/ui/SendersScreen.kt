package games.nottim.morsebuzz.ui

import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import games.nottim.morsebuzz.data.AppState
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.data.SenderMapping
import games.nottim.morsebuzz.morse.MorseEncoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun SendersScreen(
    state: AppState,
    listenerEnabled: Boolean,
    contactsGranted: Boolean,
    preview: (String) -> Unit,
    store: MappingStore,
    scope: CoroutineScope,
) {
    val context = LocalContext.current
    var editing by remember { mutableStateOf<SenderMapping?>(null) }
    var adding by remember { mutableStateOf(false) }
    val collisions = state.collidingTokens
    val contactsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text("MorseBuzz", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Feel who's messaging you, without looking.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        if (!listenerEnabled) {
            item {
                SetupCard(
                    title = "1 · Notification access",
                    body = "MorseBuzz needs to see who a notification is from. " +
                        "It only reads the sender name, never the message.",
                    buttonText = "Grant access",
                ) {
                    context.startActivity(
                        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS),
                    )
                }
            }
        }
        if (listenerEnabled && !state.settings.vibrationSilenced) {
            item {
                SetupCard(
                    title = "2 · Silence their buzz",
                    body = "Source apps vibrate on their own, and MorseBuzz can't stop " +
                        "them — you'd feel a generic buzz before the Morse. On the " +
                        "Settings tab, tap \"Silence\" next to each source app and turn " +
                        "its vibration off.",
                    buttonText = "Done — their vibration is off",
                ) {
                    scope.launch { store.setVibrationSilenced(true) }
                }
            }
        }
        if (!contactsGranted) {
            item {
                SetupCard(
                    title = "Contacts · optional",
                    body = "Lets MorseBuzz name a sender when an app only shows their " +
                        "phone number. Works fine without it.",
                    buttonText = "Allow contacts",
                ) {
                    contactsLauncher.launch(android.Manifest.permission.READ_CONTACTS)
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Senders", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { adding = true }) { Text("Add") }
            }
        }

        if (state.mappings.isEmpty()) {
            item {
                Text(
                    "No senders yet. They appear here as messages arrive, " +
                        "or add one yourself.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        items(state.mappings, key = { it.normalized }) { mapping ->
            SenderRow(
                mapping = mapping,
                collision = mapping.token in collisions,
                preview = preview,
                onClick = { editing = mapping },
            )
        }
    }

    editing?.let { mapping ->
        SenderDialog(
            title = mapping.displayName,
            initialName = mapping.displayName,
            initialToken = mapping.token,
            nameEditable = false,
            showDelete = true,
            preview = preview,
            onDismiss = { editing = null },
            onSave = { name, token ->
                scope.launch { store.upsertSender(name, token) }
                editing = null
            },
            onDelete = {
                scope.launch { store.removeSender(mapping.normalized) }
                editing = null
            },
        )
    }
    if (adding) {
        SenderDialog(
            title = "Add sender",
            initialName = "",
            initialToken = "",
            nameEditable = true,
            showDelete = false,
            preview = preview,
            onDismiss = { adding = false },
            onSave = { name, token ->
                scope.launch { store.upsertSender(name, token) }
                adding = false
            },
            onDelete = {},
        )
    }
}

@Composable
private fun SetupCard(
    title: String,
    body: String,
    buttonText: String,
    onAction: () -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(body, style = MaterialTheme.typography.bodyMedium)
            Button(onClick = onAction) { Text(buttonText) }
        }
    }
}

@Composable
private fun SenderRow(
    mapping: SenderMapping,
    collision: Boolean,
    preview: (String) -> Unit,
    onClick: () -> Unit,
) {
    Card(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(mapping.displayName, style = MaterialTheme.typography.titleMedium)
                Text(
                    "${mapping.token}   ${MorseEncoder.glyphs(mapping.token)}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (collision) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.size(4.dp))
                        Text(
                            "Same buzz as another sender",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
            IconButton(onClick = { preview(mapping.token) }) {
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = "Play ${mapping.displayName}'s buzz",
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}
