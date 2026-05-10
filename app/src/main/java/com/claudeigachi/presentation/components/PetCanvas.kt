package com.claudeigachi.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.dp
import com.claudeigachi.data.model.PetAnimation
import com.claudeigachi.data.model.PetMood
import com.claudeigachi.data.model.PetStage
import kotlin.math.sin
import kotlin.math.cos

@Composable
fun PetCanvas(
    stage: PetStage,
    mood: PetMood,
    animation: PetAnimation,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pet")

    // Idle bob
    val bobOffset by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "bob"
    )

    // Blink timer
    val blinkProgress by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = keyframes {
                durationMillis = 4000
                0f at 0; 0f at 3600; 1f at 3700; 0f at 3800
            }
        ), label = "blink"
    )

    // Sparkle rotation for celebrations
    val sparkleAngle by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(2000, easing = LinearEasing)), label = "sparkle"
    )

    // Bounce for playing
    val bounceY by infiniteTransition.animateFloat(
        initialValue = 0f, targetValue = -20f,
        animationSpec = infiniteRepeatable(
            animation = tween(400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "bounce"
    )

    // Shake for sick
    val shakeX by infiniteTransition.animateFloat(
        initialValue = -3f, targetValue = 3f,
        animationSpec = infiniteRepeatable(
            animation = tween(120, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ), label = "shake"
    )

    val petColors = stagePetColors(stage)

    Canvas(modifier = modifier.size(200.dp, 200.dp)) {
        val centerX = size.width / 2
        val centerY = size.height / 2

        val yOffset = when (animation) {
            PetAnimation.PLAYING -> bounceY
            PetAnimation.DEAD -> 15f
            PetAnimation.SLEEPING -> 4f
            else -> bobOffset
        }
        val xOffset = if (animation == PetAnimation.SICK) shakeX else 0f

        translate(xOffset, yOffset) {
            when (stage) {
                PetStage.EGG -> drawEgg(centerX, centerY, mood, blinkProgress, petColors)
                PetStage.BABY -> drawBabyPet(centerX, centerY, mood, animation, blinkProgress, petColors)
                else -> drawAdultPet(centerX, centerY, stage, mood, animation, blinkProgress, petColors)
            }

            // Overlay effects
            when (animation) {
                PetAnimation.EATING -> drawEatingEffect(centerX, centerY)
                PetAnimation.CELEBRATING -> drawSparkles(centerX, centerY, sparkleAngle)
                PetAnimation.SLEEPING -> drawZzz(centerX, centerY)
                PetAnimation.SICK -> drawSickEffect(centerX, centerY)
                PetAnimation.DEAD -> drawGrave(centerX, centerY)
                else -> {}
            }

            if (animation != PetAnimation.DEAD) {
                // Poop indicator drawn separately
            }
        }
    }
}

private fun stagePetColors(stage: PetStage): PetColors = when (stage) {
    PetStage.EGG -> PetColors(
        body = Color(0xFFFFF9C4), spots = Color(0xFFFFD54F),
        eyes = Color(0xFF5D4037), mouth = Color(0xFF8D6E63)
    )
    PetStage.BABY -> PetColors(
        body = Color(0xFFB3E5FC), spots = Color(0xFF81D4FA),
        eyes = Color(0xFF1A237E), mouth = Color(0xFFE91E63)
    )
    PetStage.CHILD -> PetColors(
        body = Color(0xFFC8E6C9), spots = Color(0xFFA5D6A7),
        eyes = Color(0xFF1B5E20), mouth = Color(0xFFF44336)
    )
    PetStage.TEEN -> PetColors(
        body = Color(0xFFE1BEE7), spots = Color(0xFFCE93D8),
        eyes = Color(0xFF4A148C), mouth = Color(0xFFE91E63)
    )
    PetStage.ADULT -> PetColors(
        body = Color(0xFFFFCCBC), spots = Color(0xFFFFAB91),
        eyes = Color(0xFF3E2723), mouth = Color(0xFFD32F2F)
    )
    PetStage.ELDER -> PetColors(
        body = Color(0xFFCFD8DC), spots = Color(0xFFB0BEC5),
        eyes = Color(0xFF37474F), mouth = Color(0xFF78909C)
    )
}

data class PetColors(val body: Color, val spots: Color, val eyes: Color, val mouth: Color)

private fun DrawScope.drawEgg(
    cx: Float, cy: Float, mood: PetMood, blink: Float, colors: PetColors
) {
    // Egg body
    drawOval(color = colors.body, topLeft = Offset(cx - 45f, cy - 58f), size = Size(90f, 110f))
    drawOval(
        color = colors.body.copy(alpha = 0.4f),
        topLeft = Offset(cx - 45f, cy - 58f), size = Size(90f, 110f),
        style = Stroke(width = 3f)
    )
    // Spots
    repeat(3) { i ->
        val angle = (i * 120 + 30) * Math.PI / 180
        val r = 22f
        drawCircle(
            color = colors.spots,
            radius = 8f,
            center = Offset(cx + (r * cos(angle)).toFloat(), cy + (r * sin(angle)).toFloat())
        )
    }
    // Eyes (tiny)
    if (blink < 0.5f) {
        drawCircle(colors.eyes, 5f, Offset(cx - 14f, cy - 5f))
        drawCircle(colors.eyes, 5f, Offset(cx + 14f, cy - 5f))
        drawCircle(Color.White, 2f, Offset(cx - 12f, cy - 7f))
        drawCircle(Color.White, 2f, Offset(cx + 16f, cy - 7f))
    } else {
        drawLine(colors.eyes, Offset(cx - 18f, cy - 5f), Offset(cx - 10f, cy - 5f), 2.5f)
        drawLine(colors.eyes, Offset(cx + 10f, cy - 5f), Offset(cx + 18f, cy - 5f), 2.5f)
    }
    // Tiny smile
    val smilePath = Path().apply {
        moveTo(cx - 8f, cy + 10f)
        quadraticBezierTo(cx, cy + 18f, cx + 8f, cy + 10f)
    }
    drawPath(smilePath, color = colors.mouth, style = Stroke(width = 2.5f))
}

private fun DrawScope.drawBabyPet(
    cx: Float, cy: Float, mood: PetMood, anim: PetAnimation, blink: Float, colors: PetColors
) {
    // Chubby round body
    drawCircle(colors.body, 52f, Offset(cx, cy + 5f))
    drawCircle(colors.spots, 14f, Offset(cx - 18f, cy + 25f)) // belly spots
    drawCircle(colors.spots, 10f, Offset(cx + 14f, cy + 30f))

    // Tiny stubby arms
    drawCircle(colors.body, 16f, Offset(cx - 62f, cy + 5f))
    drawCircle(colors.body, 16f, Offset(cx + 62f, cy + 5f))

    // Feet
    drawCircle(colors.body, 18f, Offset(cx - 26f, cy + 52f))
    drawCircle(colors.body, 18f, Offset(cx + 26f, cy + 52f))

    drawEyesAndMouth(cx, cy - 10f, mood, anim, blink, colors, scale = 0.8f)
}

private fun DrawScope.drawAdultPet(
    cx: Float, cy: Float, stage: PetStage, mood: PetMood, anim: PetAnimation, blink: Float, colors: PetColors
) {
    val bodyR = when (stage) {
        PetStage.CHILD -> 55f
        PetStage.TEEN -> 58f
        PetStage.ADULT -> 62f
        PetStage.ELDER -> 60f
        else -> 60f
    }

    // Body
    drawCircle(colors.body, bodyR, Offset(cx, cy + 8f))

    // Belly markings
    drawCircle(colors.spots.copy(alpha = 0.6f), bodyR * 0.45f, Offset(cx, cy + 22f))

    // Ears / spikes on top
    repeat(3) { i ->
        val ex = cx + (i - 1) * 32f
        val earPath = Path().apply {
            moveTo(ex - 10f, cy - bodyR + 8f)
            lineTo(ex, cy - bodyR - 20f)
            lineTo(ex + 10f, cy - bodyR + 8f)
            close()
        }
        drawPath(earPath, color = colors.spots)
    }

    // Arms
    drawOval(
        color = colors.body,
        topLeft = Offset(cx - bodyR - 28f, cy - 10f),
        size = Size(36f, 24f)
    )
    drawOval(
        color = colors.body,
        topLeft = Offset(cx + bodyR - 8f, cy - 10f),
        size = Size(36f, 24f)
    )

    // Feet
    drawOval(color = colors.body, topLeft = Offset(cx - bodyR + 2f, cy + bodyR - 12f), size = Size(40f, 22f))
    drawOval(color = colors.body, topLeft = Offset(cx + bodyR - 42f, cy + bodyR - 12f), size = Size(40f, 22f))

    // Elder wrinkles
    if (stage == PetStage.ELDER) {
        drawLine(colors.spots, Offset(cx - 35f, cy - 12f), Offset(cx - 20f, cy - 5f), 2f)
        drawLine(colors.spots, Offset(cx + 20f, cy - 12f), Offset(cx + 35f, cy - 5f), 2f)
    }

    // Teen "cool" marking
    if (stage == PetStage.TEEN) {
        drawLine(Color(0xFFAB47BC), Offset(cx - 40f, cy - 30f), Offset(cx - 20f, cy - 18f), 3f)
        drawLine(Color(0xFFAB47BC), Offset(cx + 20f, cy - 30f), Offset(cx + 40f, cy - 18f), 3f)
    }

    drawEyesAndMouth(cx, cy - 5f, mood, anim, blink, colors, scale = 1.0f)
}

private fun DrawScope.drawEyesAndMouth(
    cx: Float, cy: Float, mood: PetMood, anim: PetAnimation,
    blink: Float, colors: PetColors, scale: Float
) {
    val eyeX = 20f * scale
    val eyeY = 0f
    val eyeR = 12f * scale

    // Eyes
    if (anim == PetAnimation.DEAD) {
        // X eyes
        listOf(-eyeX, eyeX).forEach { ex ->
            val ey = cy + eyeY
            drawLine(Color.DarkGray, Offset(cx + ex - 10f, ey - 10f), Offset(cx + ex + 10f, ey + 10f), 3f)
            drawLine(Color.DarkGray, Offset(cx + ex + 10f, ey - 10f), Offset(cx + ex - 10f, ey + 10f), 3f)
        }
    } else if (mood == PetMood.SLEEPING || anim == PetAnimation.SLEEPING) {
        listOf(-eyeX, eyeX).forEach { ex ->
            // Closed curved eyes
            val eyePath = Path().apply {
                moveTo(cx + ex - eyeR, cy + eyeY)
                quadraticBezierTo(cx + ex, cy + eyeY - eyeR * 0.6f, cx + ex + eyeR, cy + eyeY)
            }
            drawPath(eyePath, colors.eyes, style = Stroke(2.5f))
        }
    } else if (blink > 0.5f) {
        listOf(-eyeX, eyeX).forEach { ex ->
            drawLine(colors.eyes, Offset(cx + ex - eyeR, cy + eyeY), Offset(cx + ex + eyeR, cy + eyeY), 2.5f)
        }
    } else {
        listOf(-eyeX, eyeX).forEach { ex ->
            drawCircle(Color.White, eyeR, Offset(cx + ex, cy + eyeY))
            drawCircle(colors.eyes, eyeR * 0.6f, Offset(cx + ex + 2f, cy + eyeY + 2f))
            drawCircle(Color.White, eyeR * 0.2f, Offset(cx + ex + eyeR * 0.3f, cy + eyeY - eyeR * 0.3f))
        }
        // Happy sparkle dots above eyes
        if (mood == PetMood.HAPPY) {
            drawCircle(Color(0xFFFFD700), 4f, Offset(cx - eyeX - 16f, cy - 22f * scale))
            drawCircle(Color(0xFFFFD700), 4f, Offset(cx + eyeX + 16f, cy - 22f * scale))
        }
    }

    // Mouth
    val mouthY = cy + 20f * scale
    when {
        anim == PetAnimation.DEAD -> {
            val frown = Path().apply {
                moveTo(cx - 16f, mouthY)
                quadraticBezierTo(cx, mouthY + 10f, cx + 16f, mouthY)
            }
            drawPath(frown, colors.mouth, style = Stroke(3f))
        }
        anim == PetAnimation.EATING -> {
            // Open mouth
            drawOval(colors.mouth, topLeft = Offset(cx - 12f, mouthY - 8f), size = Size(24f, 18f))
            drawOval(Color(0xFFFF8A65), topLeft = Offset(cx - 10f, mouthY - 4f), size = Size(20f, 12f))
        }
        mood == PetMood.HAPPY || mood == PetMood.HUNGRY.let { false }.let { true } && (mood == PetMood.HAPPY) -> {
            val smile = Path().apply {
                moveTo(cx - 16f, mouthY)
                quadraticBezierTo(cx, mouthY + 14f, cx + 16f, mouthY)
            }
            drawPath(smile, colors.mouth, style = Stroke(3f))
        }
        mood == PetMood.SAD || mood == PetMood.SICK -> {
            val frown = Path().apply {
                moveTo(cx - 16f, mouthY + 8f)
                quadraticBezierTo(cx, mouthY, cx + 16f, mouthY + 8f)
            }
            drawPath(frown, colors.mouth, style = Stroke(3f))
        }
        mood == PetMood.HUNGRY -> {
            // Wavy hungry mouth
            val wavy = Path().apply {
                moveTo(cx - 16f, mouthY + 4f)
                cubicTo(cx - 8f, mouthY, cx + 8f, mouthY + 8f, cx + 16f, mouthY + 4f)
            }
            drawPath(wavy, colors.mouth, style = Stroke(3f))
        }
        else -> {
            // Neutral line
            drawLine(colors.mouth, Offset(cx - 12f, mouthY + 4f), Offset(cx + 12f, mouthY + 4f), 2.5f)
        }
    }

    // Cheek blush when happy
    if (mood == PetMood.HAPPY) {
        drawCircle(Color(0x55FF6B9D), 10f, Offset(cx - eyeX - 10f, cy + 12f * scale))
        drawCircle(Color(0x55FF6B9D), 10f, Offset(cx + eyeX + 10f, cy + 12f * scale))
    }

    // Sick color overlay
    if (mood == PetMood.SICK) {
        drawCircle(Color(0x2200CC44), 40f, Offset(cx, cy))
    }
}

private fun DrawScope.drawEatingEffect(cx: Float, cy: Float) {
    val foods = listOf("●", "◆", "★")
    listOf(
        Offset(cx - 50f, cy - 70f),
        Offset(cx + 50f, cy - 60f),
        Offset(cx - 20f, cy - 85f)
    ).forEachIndexed { i, pos ->
        drawCircle(
            color = listOf(Color(0xFFFF8C00), Color(0xFFFF1493), Color(0xFF32CD32))[i],
            radius = 6f, center = pos
        )
    }
}

private fun DrawScope.drawSparkles(cx: Float, cy: Float, angle: Float) {
    repeat(6) { i ->
        val theta = (angle + i * 60f) * Math.PI / 180
        val r = 75f
        val sx = cx + (r * cos(theta)).toFloat()
        val sy = cy - 20f + (r * sin(theta)).toFloat()
        drawCircle(Color(0xFFFFD700), 5f, Offset(sx, sy))
        // Star lines
        drawLine(Color(0xFFFFD700), Offset(sx - 6f, sy), Offset(sx + 6f, sy), 1.5f)
        drawLine(Color(0xFFFFD700), Offset(sx, sy - 6f), Offset(sx, sy + 6f), 1.5f)
    }
}

private fun DrawScope.drawZzz(cx: Float, cy: Float) {
    // Three Z's floating up-right
    listOf(
        Triple(cx + 55f, cy - 60f, 16f),
        Triple(cx + 70f, cy - 82f, 20f),
        Triple(cx + 88f, cy - 108f, 24f)
    ).forEach { (zx, zy, size) ->
        val zPath = Path().apply {
            moveTo(zx, zy - size / 2)
            lineTo(zx + size, zy - size / 2)
            lineTo(zx, zy + size / 2)
            lineTo(zx + size, zy + size / 2)
        }
        drawPath(zPath, Color(0xFF7986CB), style = Stroke(2.5f))
    }
}

private fun DrawScope.drawSickEffect(cx: Float, cy: Float) {
    // Green swirl dots
    repeat(5) { i ->
        val angle = i * 72f * Math.PI / 180
        val r = 65f
        drawCircle(
            Color(0x8800CC44),
            7f,
            Offset(cx + (r * cos(angle)).toFloat(), cy - 10f + (r * sin(angle)).toFloat())
        )
    }
}

private fun DrawScope.drawGrave(cx: Float, cy: Float) {
    // Tombstone
    drawRect(Color(0xFF9E9E9E), topLeft = Offset(cx - 25f, cy + 55f), size = Size(50f, 35f))
    drawOval(Color(0xFF9E9E9E), topLeft = Offset(cx - 25f, cy + 30f), size = Size(50f, 40f))
    drawLine(Color(0xFF616161), Offset(cx, cy + 38f), Offset(cx, cy + 72f), 3f)
    drawLine(Color(0xFF616161), Offset(cx - 10f, cy + 52f), Offset(cx + 10f, cy + 52f), 3f)
}

@Composable
fun PoopIndicator(count: Int, modifier: Modifier = Modifier) {
    if (count <= 0) return
    Canvas(modifier = modifier.size(80.dp, 40.dp)) {
        repeat(count.coerceAtMost(3)) { i ->
            val x = 20f + i * 28f
            drawCircle(Color(0xFF795548), 10f, Offset(x, 20f))
            drawCircle(Color(0xFF795548), 8f, Offset(x - 4f, 12f))
            drawCircle(Color(0xFF795548), 6f, Offset(x, 5f))
        }
    }
}
