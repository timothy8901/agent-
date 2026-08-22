package games.nottim.morsebuzz.morse

/** Pure-Kotlin entry point: text in, Android-shaped waveform out. */
object MorseEncoder {

    /** Full-strength encoding with no truncation - the spec's golden signature. */
    fun encode(text: String, ditMs: Long): Waveform = WaveformBuilder.build(text, ditMs)

    /** Human-readable dots and dashes for a token, e.g. "MR" -> "-- .-." */
    fun glyphs(text: String): String =
        MorseCode.normalize(text)
            .mapNotNull { MorseCode.symbolsFor(it) }
            .joinToString(" ")
            .replace('.', '·') // middle dot reads better than a period
            .replace('-', '–')
}
