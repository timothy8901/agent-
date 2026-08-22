package games.nottim.morsebuzz.data

/**
 * User-tunable behavior. Defaults follow the build spec: haptic-scale Morse
 * timing (not textbook 60ms dits), a 3-character payload cap, and a hard
 * total-duration budget.
 */
data class AppSettings(
    val ditMs: Long = 130,
    val amplitudeMode: Boolean = true,
    val maxChars: Int = 3,
    val budgetMs: Long = 3500,
    val debounceSeconds: Int = 20,
    val skipWhenScreenOn: Boolean = true,
    val unknownSenderDit: Boolean = false,
    /** User confirmed they turned off vibration on the source apps (spec §1.3). */
    val vibrationSilenced: Boolean = false,
    val allowedPackages: Set<String> = emptySet(),
)

data class SenderMapping(
    val displayName: String,
    val normalized: String,
    val token: String,
)

data class AppState(
    val settings: AppSettings = AppSettings(),
    val mappings: List<SenderMapping> = emptyList(),
) {
    /** Tokens assigned to more than one sender - two people buzzing "JB" defeats the point. */
    val collidingTokens: Set<String>
        get() = mappings.filter { it.token.isNotEmpty() }
            .groupingBy { it.token }.eachCount()
            .filterValues { it > 1 }.keys
}
