package games.nottim.morsebuzz.morse

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MorseEncoderTest {

    @Test
    fun `golden vector - MOM at 100ms dit`() {
        // M = dah-dah, O = dah-dah-dah, M = dah-dah. Hand-verified:
        // [off 0][M: 300,100,300][gap 300][O: 300,100,300,100,300][gap 300][M: 300,100,300]
        val expected = longArrayOf(0, 300, 100, 300, 300, 300, 100, 300, 100, 300, 300, 300, 100, 300)
        val waveform = MorseEncoder.encode("MOM", 100)

        assertArrayEquals(expected, waveform.timings)
        // Off slots are 0, on slots are full strength by default.
        val expectedAmps = intArrayOf(0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255)
        assertArrayEquals(expectedAmps, waveform.amplitudes)
    }

    @Test
    fun `waveform starts with a zero off duration`() {
        val waveform = MorseEncoder.encode("A", 100)
        assertEquals(0L, waveform.timings[0])
        assertEquals(0, waveform.amplitudes[0])
    }

    @Test
    fun `empty string returns empty waveform`() {
        assertTrue(MorseEncoder.encode("", 100).isEmpty)
    }

    @Test
    fun `unmapped characters are dropped`() {
        assertEquals(MorseEncoder.encode("MM", 100), MorseEncoder.encode("M@ M!", 100))
        assertTrue(MorseEncoder.encode("!@# %^&", 100).isEmpty)
    }

    @Test
    fun `single character works`() {
        // E is a single dit.
        val waveform = MorseEncoder.encode("E", 100)
        assertArrayEquals(longArrayOf(0, 100), waveform.timings)
        assertArrayEquals(intArrayOf(0, 255), waveform.amplitudes)
    }

    @Test
    fun `lowercase and diacritics normalize`() {
        assertEquals(MorseEncoder.encode("MO", 100), MorseEncoder.encode("mó", 100))
    }

    @Test
    fun `digits encode`() {
        // 5 = dit x5
        val waveform = MorseEncoder.encode("5", 100)
        assertArrayEquals(longArrayOf(0, 100, 100, 100, 100, 100, 100, 100, 100, 100), waveform.timings)
    }

    @Test
    fun `glyphs render dots and dashes`() {
        assertEquals("–– ·–·", MorseEncoder.glyphs("mr"))
        assertEquals("", MorseEncoder.glyphs("!"))
    }
}
