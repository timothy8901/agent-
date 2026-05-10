package com.claudeigachi.presentation.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.claudeigachi.presentation.viewmodel.PetViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: PetViewModel, onBack: () -> Unit) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    var apiKeyInput by remember(state.apiKey) { mutableStateOf(state.apiKey) }
    var petNameInput by remember(state.petName) { mutableStateOf(state.petName) }
    var showApiKey by remember { mutableStateOf(false) }
    var showResetDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.toastMessage) {
        state.toastMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearToast()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Pet Settings
            SettingsSection(title = "Pet") {
                OutlinedTextField(
                    value = petNameInput,
                    onValueChange = { petNameInput = it.take(20) },
                    label = { Text("Pet Name") },
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = { Text("${petNameInput.length}/20 characters") },
                    singleLine = true
                )
                Button(
                    onClick = { viewModel.renamePet(petNameInput) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = petNameInput.isNotBlank()
                ) {
                    Text("Save Name")
                }

                // Pet stats summary
                state.pet?.let { pet ->
                    Spacer(Modifier.height(4.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Pet Info", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            StatLine("Stage", pet.stage.displayName)
                            StatLine("Age", "${pet.age / 60} hours old")
                            StatLine("Total meals", "${pet.totalMeals}")
                            StatLine("Play sessions", "${pet.totalPlaySessions}")
                            StatLine("Overall wellness", "${pet.overallHealth}%")
                        }
                    }
                }
            }

            // Claude API
            SettingsSection(title = "Claude AI") {
                Text(
                    "Get your free API key at console.anthropic.com — it lets your pet talk back!",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
                OutlinedTextField(
                    value = apiKeyInput,
                    onValueChange = { apiKeyInput = it.trim() },
                    label = { Text("Anthropic API Key") },
                    placeholder = { Text("sk-ant-...") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    visualTransformation = if (showApiKey) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showApiKey = !showApiKey }) {
                            Icon(
                                if (showApiKey) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null
                            )
                        }
                    }
                )
                Button(
                    onClick = { viewModel.saveApiKey(apiKeyInput) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = apiKeyInput.isNotBlank()
                ) {
                    Text("Save API Key")
                }
                if (state.apiKey.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("✅", fontSize = 14.sp)
                        Spacer(Modifier.width(6.dp))
                        Text("API key configured", fontSize = 13.sp, color = Color(0xFF388E3C))
                    }
                }
            }

            // Danger Zone
            SettingsSection(title = "Danger Zone") {
                Button(
                    onClick = { showResetDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Reset Pet (Start Over)")
                }
            }

            // About
            SettingsSection(title = "About") {
                Text(
                    "Claude-Igachi v1.0\n\nA classic Tamagotchi experience powered by Claude AI. Keep your pet fed, happy, healthy, and clean — and have real conversations with it!\n\nBuilt with Jetpack Compose + Anthropic Claude API.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    lineHeight = 20.sp
                )
            }
        }
    }

    if (showResetDialog) {
        AlertDialog(
            onDismissRequest = { showResetDialog = false },
            title = { Text("Reset Pet?") },
            text = { Text("This will permanently delete your pet and all chat history. A new egg will hatch!") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.resetPet(); showResetDialog = false; onBack() },
                    colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFFE53935))
                ) { Text("Reset") }
            },
            dismissButton = {
                TextButton(onClick = { showResetDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            letterSpacing = 1.sp
        )
        HorizontalDivider(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
        content()
    }
}

@Composable
private fun StatLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}
