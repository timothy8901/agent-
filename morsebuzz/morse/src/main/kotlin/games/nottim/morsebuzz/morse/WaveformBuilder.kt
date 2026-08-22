package games.nottim.morsebuzz.morse

/**
 * Turns text into a vibration [Waveform].
 *
 * Timing units (multiples of ditMs): dit on = 1, dah on = 3,
 * intra-character gap = 1, inter-character gap = 3. Word gaps are skipped
 * entirely - payloads are three characters, not prose.
 */
object WaveformBuilder {

    const val MAX_AMPLITUDE = 255

    /** Soft default for dits in amplitude-differentiated mode. */
    const val SOFT_AMPLITUDE = 120

    private const val DAH_UNITS = 3L
    private const val INTRA_GAP_UNITS = 1L
    private const val INTER_GAP_UNITS = 3L

    /**
     * Builds the waveform for [text].
     *
     * Unmapped characters are dropped. At most [maxChars] characters are
     * encoded, and characters that would push the total duration past
     * [budgetMs] are truncated at a character boundary - never mid-symbol.
     * At least one character is always kept so a valid payload never
     * silently becomes nothing.
     */
    fun build(
        text: String,
        ditMs: Long,
        ditAmplitude: Int = MAX_AMPLITUDE,
        dahAmplitude: Int = MAX_AMPLITUDE,
        maxChars: Int = Int.MAX_VALUE,
        budgetMs: Long = Long.MAX_VALUE,
    ): Waveform {
        require(ditMs > 0) { "ditMs must be positive" }
        val chars = MorseCode.normalize(text).take(maxChars.coerceAtLeast(1))
        if (chars.isEmpty()) return Waveform.EMPTY

        val timings = ArrayList<Long>()
        val amplitudes = ArrayList<Int>()
        var total = 0L

        for ((index, char) in chars.withIndex()) {
            val symbols = MorseCode.symbolsFor(char) ?: continue
            val interGap = if (index == 0) 0L else INTER_GAP_UNITS * ditMs
            val charCost = interGap + charDurationMs(symbols, ditMs)

            // Budget truncation happens at a character boundary; the first
            // character always plays even if it alone exceeds the budget.
            if (index > 0 && total + charCost > budgetMs) break

            if (index == 0) {
                timings.add(0L) // Android waveforms start with an off duration.
                amplitudes.add(0)
            } else {
                timings.add(interGap)
                amplitudes.add(0)
            }

            for ((symbolIndex, symbol) in symbols.withIndex()) {
                if (symbolIndex > 0) {
                    timings.add(INTRA_GAP_UNITS * ditMs)
                    amplitudes.add(0)
                }
                if (symbol == '-') {
                    timings.add(DAH_UNITS * ditMs)
                    amplitudes.add(dahAmplitude)
                } else {
                    timings.add(ditMs)
                    amplitudes.add(ditAmplitude)
                }
            }
            total += charCost
        }

        return Waveform(timings.toLongArray(), amplitudes.toIntArray())
    }

    /** Duration of one character's symbols plus intra-character gaps. */
    fun charDurationMs(symbols: String, ditMs: Long): Long {
        var on = 0L
        for (symbol in symbols) on += if (symbol == '-') DAH_UNITS * ditMs else ditMs
        return on + (symbols.length - 1) * INTRA_GAP_UNITS * ditMs
    }
}
