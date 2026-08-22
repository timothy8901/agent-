package games.nottim.morsebuzz.vibe

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import games.nottim.morsebuzz.data.AppSettings
import games.nottim.morsebuzz.morse.Waveform
import games.nottim.morsebuzz.morse.WaveformBuilder

/**
 * Thin wrapper around the platform vibrator. Feature-detects amplitude
 * control; without it, dits and dahs fall back to duration-only
 * differentiation. Vibrations are tagged as notification usage, which means
 * Do Not Disturb can suppress them - surfaced in settings copy, not worked
 * around.
 */
class Buzzer(context: Context) {

    private val vibrator: Vibrator =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

    val hasVibrator: Boolean get() = vibrator.hasVibrator()

    val hasAmplitudeControl: Boolean get() = vibrator.hasAmplitudeControl()

    /** Builds the waveform for [text] under the user's current tuning. */
    fun waveformFor(text: String, settings: AppSettings): Waveform =
        WaveformBuilder.build(
            text = text,
            ditMs = settings.ditMs,
            ditAmplitude = if (settings.amplitudeMode && hasAmplitudeControl) {
                WaveformBuilder.SOFT_AMPLITUDE
            } else {
                WaveformBuilder.MAX_AMPLITUDE
            },
            dahAmplitude = WaveformBuilder.MAX_AMPLITUDE,
            maxChars = settings.maxChars,
            budgetMs = settings.budgetMs,
        )

    fun buzz(waveform: Waveform) {
        if (waveform.isEmpty || !hasVibrator) return
        cancel()
        val effect = if (hasAmplitudeControl) {
            VibrationEffect.createWaveform(waveform.timings, waveform.amplitudes, -1)
        } else {
            VibrationEffect.createWaveform(waveform.timings, -1)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(
                effect,
                VibrationAttributes.createForUsage(VibrationAttributes.USAGE_NOTIFICATION),
            )
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(
                effect,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build(),
            )
        }
    }

    fun buzz(text: String, settings: AppSettings) = buzz(waveformFor(text, settings))

    fun cancel() = vibrator.cancel()
}
