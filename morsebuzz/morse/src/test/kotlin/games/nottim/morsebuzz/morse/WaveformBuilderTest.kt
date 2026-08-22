package games.nottim.morsebuzz.morse

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformBuilderTest {

    @Test
    fun `amplitude mode renders soft dits and strong dahs`() {
        // A = dit-dah
        val waveform = WaveformBuilder.build("A", 100, ditAmplitude = 120, dahAmplitude = 255)
        assertArrayEquals(longArrayOf(0, 100, 100, 300), waveform.timings)
        assertArrayEquals(intArrayOf(0, 120, 0, 255), waveform.amplitudes)
    }

    @Test
    fun `maxChars truncates the payload`() {
        val full = WaveformBuilder.build("MOM", 100)
        val capped = WaveformBuilder.build("MOMENT", 100, maxChars = 3)
        assertEquals(full, capped)
    }

    @Test
    fun `budget truncates at a character boundary, never mid-symbol`() {
        // E = 100ms. "EEE" cumulative: 100, then +300 gap +100 = 500, then +400 = 900.
        val budgeted = WaveformBuilder.build("EEE", 100, budgetMs = 600)
        val twoChars = WaveformBuilder.build("EE", 100)
        assertEquals(twoChars, budgeted)
        assertEquals(500L, budgeted.totalMs)
    }

    @Test
    fun `budget keeps at least one character`() {
        // O alone is 1100ms at a 100ms dit; a tiny budget must not produce silence.
        val waveform = WaveformBuilder.build("OO", 100, budgetMs = 50)
        assertEquals(WaveformBuilder.build("O", 100), waveform)
    }

    @Test
    fun `budget exactly at boundary keeps the character`() {
        // "EE" totals exactly 500ms.
        val waveform = WaveformBuilder.build("EE", 100, budgetMs = 500)
        assertEquals(500L, waveform.totalMs)
        assertEquals(4, waveform.timings.size)
    }

    @Test
    fun `char duration math`() {
        assertEquals(100L, WaveformBuilder.charDurationMs(".", 100))
        assertEquals(300L, WaveformBuilder.charDurationMs("-", 100))
        assertEquals(700L, WaveformBuilder.charDurationMs("--", 100))
        assertEquals(1100L, WaveformBuilder.charDurationMs("---", 100))
    }

    @Test
    fun `timings and amplitudes always same length and alternate off-on`() {
        val waveform = WaveformBuilder.build("SOS", 130)
        assertEquals(waveform.timings.size, waveform.amplitudes.size)
        waveform.amplitudes.forEachIndexed { index, amp ->
            if (index % 2 == 0) assertEquals(0, amp) else assertTrue(amp > 0)
        }
    }

    @Test
    fun `defaults match the spec`() {
        assertEquals(255, WaveformBuilder.MAX_AMPLITUDE)
        assertEquals(120, WaveformBuilder.SOFT_AMPLITUDE)
    }
}
