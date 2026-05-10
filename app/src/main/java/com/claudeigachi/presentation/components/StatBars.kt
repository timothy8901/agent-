package com.claudeigachi.presentation.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.claudeigachi.data.model.Pet

@Composable
fun PetStatBars(pet: Pet, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        StatRow("🍖", "Hunger", pet.hunger, hungerColor(pet.hunger))
        StatRow("😊", "Happy", pet.happiness, happinessColor(pet.happiness))
        StatRow("💚", "Health", pet.health, healthColor(pet.health))
        StatRow("⚡", "Energy", pet.energy, energyColor(pet.energy))
        StatRow("✨", "Clean", pet.cleanliness, cleanColor(pet.cleanliness))
    }
}

@Composable
private fun StatRow(emoji: String, label: String, value: Int, color: Color) {
    val animatedValue by animateFloatAsState(
        targetValue = value / 100f,
        animationSpec = tween(500),
        label = label
    )

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(emoji, fontSize = 14.sp, modifier = Modifier.width(24.dp))
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
            modifier = Modifier.width(46.dp)
        )
        Spacer(Modifier.width(6.dp))
        LinearProgressIndicator(
            progress = { animatedValue },
            modifier = Modifier.weight(1f).height(10.dp),
            color = color,
            trackColor = color.copy(alpha = 0.2f),
            strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
            gapSize = 0.dp
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "$value",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = color,
            modifier = Modifier.width(28.dp)
        )
    }
}

private fun hungerColor(v: Int) = when {
    v < 20 -> Color(0xFFE53935)
    v < 40 -> Color(0xFFFF9800)
    else -> Color(0xFF43A047)
}

private fun happinessColor(v: Int) = when {
    v < 20 -> Color(0xFFE53935)
    v < 40 -> Color(0xFFFF9800)
    else -> Color(0xFFFFCA28)
}

private fun healthColor(v: Int) = when {
    v < 20 -> Color(0xFFE53935)
    v < 40 -> Color(0xFFFF9800)
    else -> Color(0xFF26C6DA)
}

private fun energyColor(v: Int) = when {
    v < 20 -> Color(0xFF9E9E9E)
    v < 40 -> Color(0xFFFF9800)
    else -> Color(0xFF7E57C2)
}

private fun cleanColor(v: Int) = when {
    v < 20 -> Color(0xFF795548)
    v < 40 -> Color(0xFFFF9800)
    else -> Color(0xFF29B6F6)
}

@Composable
fun PetInfoChips(pet: Pet, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        InfoChip("Age", "${pet.age / 60}h")
        InfoChip("Stage", pet.stage.displayName)
        InfoChip("Weight", "${pet.weight}g")
        if (pet.isSick) InfoChip("Status", "Sick", Color(0xFFE53935))
        if (pet.isSleeping) InfoChip("Status", "Zzz...", Color(0xFF7E57C2))
    }
}

@Composable
private fun InfoChip(label: String, value: String, color: Color = MaterialTheme.colorScheme.primary) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text(label, fontSize = 9.sp, color = color.copy(alpha = 0.7f), fontWeight = FontWeight.Medium)
            Text(value, fontSize = 12.sp, color = color, fontWeight = FontWeight.Bold)
        }
    }
}
