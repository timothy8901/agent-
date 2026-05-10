package com.claudeigachi.presentation.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.claudeigachi.data.model.PetAnimation
import com.claudeigachi.data.model.PetMood
import com.claudeigachi.presentation.components.*
import com.claudeigachi.presentation.viewmodel.PetViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: PetViewModel,
    onNavigateToChat: () -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    // Toast snackbar
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.toastMessage) {
        state.toastMessage?.let {
            snackbarHostState.showSnackbar(it, duration = SnackbarDuration.Short)
            viewModel.clearToast()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        state.pet?.name ?: "Claude-Igachi",
                        fontWeight = FontWeight.Bold
                    )
                },
                actions = {
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { padding ->
        val pet = state.pet
        if (state.isLoading || pet == null) {
            Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(backgroundGradient(pet.mood))
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Life stage + info chips
            PetInfoChips(
                pet = pet,
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
            )

            // Pet viewport
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(petBackgroundColor(pet.mood)),
                contentAlignment = Alignment.Center
            ) {
                PetCanvas(
                    stage = pet.stage,
                    mood = pet.mood,
                    animation = if (pet.isSleeping) PetAnimation.SLEEPING else state.animation
                )

                // Poop indicator bottom-left
                if (pet.poopCount > 0 && !pet.isDead) {
                    PoopIndicator(
                        count = pet.poopCount,
                        modifier = Modifier.align(Alignment.BottomStart).padding(8.dp)
                    )
                }

                // Dead overlay
                if (pet.isDead) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.align(Alignment.TopCenter).padding(top = 12.dp)
                    ) {
                        Text("💀", fontSize = 20.sp)
                        Text(
                            "Passed Away",
                            fontSize = 12.sp,
                            color = Color.Gray,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Mood speech bubble
                if (!pet.isDead) {
                    val bubbleText = moodBubble(pet.mood)
                    if (bubbleText != null) {
                        Surface(
                            modifier = Modifier.align(Alignment.TopEnd).padding(8.dp),
                            shape = RoundedCornerShape(12.dp),
                            color = Color.White.copy(alpha = 0.85f),
                            tonalElevation = 2.dp
                        ) {
                            Text(
                                bubbleText,
                                modifier = Modifier.padding(6.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Stat bars
            PetStatBars(pet = pet, modifier = Modifier.fillMaxWidth())

            Spacer(Modifier.height(12.dp))

            // Action buttons
            ActionButtons(
                pet = pet,
                onFeed = viewModel::feed,
                onPlay = viewModel::play,
                onSleep = viewModel::toggleSleep,
                onClean = viewModel::clean,
                onHeal = viewModel::heal,
                onChat = onNavigateToChat,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(8.dp))

            // Dead → new game button
            if (pet.isDead) {
                var showConfirm by remember { mutableStateOf(false) }
                Button(
                    onClick = { showConfirm = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6750A4)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Start Over with New Egg 🥚")
                }
                if (showConfirm) {
                    AlertDialog(
                        onDismissRequest = { showConfirm = false },
                        title = { Text("Start Over?") },
                        text = { Text("Your pet has passed. Hatch a new egg and try again?") },
                        confirmButton = {
                            TextButton(onClick = { viewModel.resetPet(); showConfirm = false }) {
                                Text("New Egg")
                            }
                        },
                        dismissButton = {
                            TextButton(onClick = { showConfirm = false }) { Text("Cancel") }
                        }
                    )
                }
            }
        }
    }
}

private fun moodBubble(mood: PetMood): String? = when (mood) {
    PetMood.HUNGRY -> "Feed me! 🍖"
    PetMood.TIRED -> "Sleepy... 😴"
    PetMood.SAD -> "I'm lonely 😢"
    PetMood.SICK -> "Not feeling well 🤒"
    PetMood.DIRTY -> "Eww, clean me! 🚿"
    PetMood.HAPPY -> "So happy! ✨"
    else -> null
}

@Composable
private fun backgroundGradient(mood: PetMood): Brush = Brush.verticalGradient(
    colors = when (mood) {
        PetMood.HAPPY -> listOf(Color(0xFFFFF9C4), Color(0xFFF8F5FF))
        PetMood.SICK -> listOf(Color(0xFFE8F5E9), Color(0xFFF1F8E9))
        PetMood.DEAD -> listOf(Color(0xFFEEEEEE), Color(0xFFBDBDBD))
        PetMood.SLEEPING -> listOf(Color(0xFFEDE7F6), Color(0xFFF3E5F5))
        else -> listOf(Color(0xFFF8F5FF), Color(0xFFEDE7F6))
    }
)

private fun petBackgroundColor(mood: PetMood): Color = when (mood) {
    PetMood.HAPPY -> Color(0xFFE8F5E9)
    PetMood.SICK -> Color(0xFFF1F8E9)
    PetMood.DEAD -> Color(0xFFEEEEEE)
    PetMood.SLEEPING -> Color(0xFFEDE7F6)
    PetMood.HUNGRY -> Color(0xFFFFF8E1)
    else -> Color(0xFFEDE7F6)
}
