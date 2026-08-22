package games.nottim.morsebuzz.morse

/**
 * Vibration waveform in Android's alternating off/on format: [timings] starts
 * with an off duration (index 0 is 0 for immediate start), and [amplitudes]
 * holds 0 for off slots and 1-255 for on slots.
 */
data class Waveform(val timings: LongArray, val amplitudes: IntArray) {

    init {
        require(timings.size == amplitudes.size) { "timings and amplitudes must be the same length" }
    }

    val isEmpty: Boolean get() = timings.isEmpty()

    val totalMs: Long get() = timings.sum()

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Waveform) return false
        return timings.contentEquals(other.timings) && amplitudes.contentEquals(other.amplitudes)
    }

    override fun hashCode(): Int = 31 * timings.contentHashCode() + amplitudes.contentHashCode()

    override fun toString(): String =
        "Waveform(timings=${timings.toList()}, amplitudes=${amplitudes.toList()})"

    companion object {
        val EMPTY = Waveform(LongArray(0), IntArray(0))
    }
}
