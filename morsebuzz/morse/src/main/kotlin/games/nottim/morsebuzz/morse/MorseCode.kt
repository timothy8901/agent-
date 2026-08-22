package games.nottim.morsebuzz.morse

import java.text.Normalizer

/** ITU Morse code for A-Z and 0-9. Everything else is unmapped and gets dropped. */
object MorseCode {

    val MAP: Map<Char, String> = mapOf(
        'A' to ".-", 'B' to "-...", 'C' to "-.-.", 'D' to "-..", 'E' to ".",
        'F' to "..-.", 'G' to "--.", 'H' to "....", 'I' to "..", 'J' to ".---",
        'K' to "-.-", 'L' to ".-..", 'M' to "--", 'N' to "-.", 'O' to "---",
        'P' to ".--.", 'Q' to "--.-", 'R' to ".-.", 'S' to "...", 'T' to "-",
        'U' to "..-", 'V' to "...-", 'W' to ".--", 'X' to "-..-", 'Y' to "-.--",
        'Z' to "--..",
        '0' to "-----", '1' to ".----", '2' to "..---", '3' to "...--",
        '4' to "....-", '5' to ".....", '6' to "-....", '7' to "--...",
        '8' to "---..", '9' to "----.",
    )

    /** Uppercases, strips diacritics, and drops every unmapped character. */
    fun normalize(text: String): String {
        val decomposed = Normalizer.normalize(text, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return decomposed.uppercase().filter { it in MAP }
    }

    /** Symbols for a single already-normalized character, or null if unmapped. */
    fun symbolsFor(char: Char): String? = MAP[char]
}
