package com.claudeigachi.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.claudeigachi.data.model.Pet

@Composable
fun ActionButtons(
    pet: Pet?,
    onFeed: () -> Unit,
    onPlay: () -> Unit,
    onSleep: () -> Unit,
    onClean: () -> Unit,
    onHeal: () -> Unit,
    onChat: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isDead = pet?.isDead == true
    val isSleeping = pet?.isSleeping == true

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            ActionButton(
                emoji = "🍖", label = "Feed",
                color = Color(0xFFEF6C00),
                enabled = !isDead && !isSleeping,
                modifier = Modifier.weight(1f),
                onClick = onFeed
            )
            ActionButton(
                emoji = "🎮", label = "Play",
                color = Color(0xFF1976D2),
                enabled = !isDead && !isSleeping && (pet?.energy ?: 0) >= 10,
                modifier = Modifier.weight(1f),
                onClick = onPlay
            )
            ActionButton(
                emoji = if (isSleeping) "☀️" else "💤",
                label = if (isSleeping) "Wake" else "Sleep",
                color = Color(0xFF7B1FA2),
                enabled = !isDead,
                modifier = Modifier.weight(1f),
                onClick = onSleep
            )
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            ActionButton(
                emoji = "🚿",
                label = "Clean",
                color = Color(0xFF0288D1),
                badgeCount = pet?.poopCount ?: 0,
                enabled = !isDead,
                modifier = Modifier.weight(1f),
                onClick = onClean
            )
            ActionButton(
                emoji = "💊",
                label = "Heal",
                color = Color(0xFF388E3C),
                highlighted = pet?.isSick == true,
                enabled = !isDead,
                modifier = Modifier.weight(1f),
                onClick = onHeal
            )
            ActionButton(
                emoji = "💬",
                label = "Talk",
                color = Color(0xFFC62828),
                enabled = !isDead,
                modifier = Modifier.weight(1f),
                onClick = onChat
            )
        }
    }
}

@Composable
private fun ActionButton(
    emoji: String,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    badgeCount: Int = 0,
    highlighted: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.92f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "btnScale"
    )

    // Pulse animation for highlighted (sick indicator)
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.7f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label = "pulseAlpha"
    )

    Box(modifier = modifier) {
        Button(
            onClick = {
                pressed = true
                onClick()
                pressed = false
            },
            enabled = enabled,
            modifier = Modifier
                .fillMaxWidth()
                .scale(scale),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (highlighted) color.copy(alpha = pulseAlpha) else color,
                disabledContainerColor = color.copy(alpha = 0.3f)
            ),
            contentPadding = PaddingValues(vertical = 12.dp, horizontal = 4.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(emoji, fontSize = 22.sp)
                Text(
                    label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = if (enabled) 1f else 0.5f)
                )
            }
        }

        // Poop badge
        if (badgeCount > 0) {
            Badge(
                modifier = Modifier.align(Alignment.TopEnd).offset((-4).dp, 4.dp),
                containerColor = Color(0xFF795548)
            ) {
                Text("$badgeCount", color = Color.White, fontSize = 9.sp)
            }
        }
    }
}
