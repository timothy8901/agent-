package games.nottim.morsebuzz.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.morse.MorseEncoder

/** Edit or add a sender: name, feelable token (max 4 chars), instant preview. */
@Composable
fun SenderDialog(
    title: String,
    initialName: String,
    initialToken: String,
    nameEditable: Boolean,
    showDelete: Boolean,
    preview: (String) -> Unit,
    onDismiss: () -> Unit,
    onSave: (name: String, token: String) -> Unit,
    onDelete: () -> Unit,
) {
    var name by remember { mutableStateOf(initialName) }
    var token by remember { mutableStateOf(initialToken) }
    val autoToken = MappingStore.initialsOf(name)
    val effectiveToken = token.ifEmpty { autoToken }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (nameEditable) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                OutlinedTextField(
                    value = token,
                    onValueChange = { input ->
                        token = input.uppercase().filter { it.isLetterOrDigit() }.take(4)
                    },
                    label = { Text("Buzz pattern") },
                    placeholder = { Text(autoToken.ifEmpty { "Initials" }) },
                    supportingText = {
                        Text(
                            MorseEncoder.glyphs(effectiveToken).ifEmpty { "Letters or digits, up to 4" },
                            fontFamily = FontFamily.Monospace,
                        )
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(
                        onClick = { preview(effectiveToken) },
                        enabled = effectiveToken.isNotEmpty(),
                    ) { Text("Feel it") }
                    if (showDelete) {
                        TextButton(onClick = onDelete) {
                            Text("Delete", color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), effectiveToken) },
                enabled = name.isNotBlank() && effectiveToken.isNotEmpty(),
            ) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
