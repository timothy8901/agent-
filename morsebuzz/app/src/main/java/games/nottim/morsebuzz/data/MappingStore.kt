package games.nottim.morsebuzz.data

import android.content.Context
import android.provider.Telephony
import android.telecom.TelecomManager
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import games.nottim.morsebuzz.morse.MorseCode
import java.text.Normalizer
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "morsebuzz")

/** Persists settings and the normalizedSenderName -> morseToken mapping (DataStore, no Room). */
class MappingStore(private val context: Context) {

    private object Keys {
        val DIT_MS = longPreferencesKey("dit_ms")
        val AMPLITUDE_MODE = booleanPreferencesKey("amplitude_mode")
        val MAX_CHARS = intPreferencesKey("max_chars")
        val BUDGET_MS = longPreferencesKey("budget_ms")
        val DEBOUNCE_SECONDS = intPreferencesKey("debounce_seconds")
        val SKIP_WHEN_SCREEN_ON = booleanPreferencesKey("skip_when_screen_on")
        val UNKNOWN_SENDER_DIT = booleanPreferencesKey("unknown_sender_dit")
        val VIBRATION_SILENCED = booleanPreferencesKey("vibration_silenced")
        val ALLOWED_PACKAGES = stringSetPreferencesKey("allowed_packages")
        val MAPPINGS = stringSetPreferencesKey("mappings")
    }

    /** Default SMS app plus the dialer, so texts and incoming calls work out of the box. */
    private val defaultAllowlist: Set<String> by lazy {
        buildSet {
            runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()?.let(::add)
            runCatching { context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage }
                .getOrNull()?.let(::add)
        }
    }

    val state: Flow<AppState> = context.dataStore.data.map { prefs ->
        val defaults = AppSettings()
        AppState(
            settings = AppSettings(
                ditMs = prefs[Keys.DIT_MS] ?: defaults.ditMs,
                amplitudeMode = prefs[Keys.AMPLITUDE_MODE] ?: defaults.amplitudeMode,
                maxChars = prefs[Keys.MAX_CHARS] ?: defaults.maxChars,
                budgetMs = prefs[Keys.BUDGET_MS] ?: defaults.budgetMs,
                debounceSeconds = prefs[Keys.DEBOUNCE_SECONDS] ?: defaults.debounceSeconds,
                skipWhenScreenOn = prefs[Keys.SKIP_WHEN_SCREEN_ON] ?: defaults.skipWhenScreenOn,
                unknownSenderDit = prefs[Keys.UNKNOWN_SENDER_DIT] ?: defaults.unknownSenderDit,
                vibrationSilenced = prefs[Keys.VIBRATION_SILENCED] ?: defaults.vibrationSilenced,
                allowedPackages = prefs[Keys.ALLOWED_PACKAGES] ?: defaultAllowlist,
            ),
            mappings = (prefs[Keys.MAPPINGS] ?: emptySet())
                .mapNotNull(::decodeMapping)
                .sortedBy { it.displayName.lowercase() },
        )
    }

    suspend fun current(): AppState = state.first()

    suspend fun setDitMs(value: Long) = edit { it[Keys.DIT_MS] = value }
    suspend fun setAmplitudeMode(value: Boolean) = edit { it[Keys.AMPLITUDE_MODE] = value }
    suspend fun setMaxChars(value: Int) = edit { it[Keys.MAX_CHARS] = value.coerceIn(1, 4) }
    suspend fun setBudgetMs(value: Long) = edit { it[Keys.BUDGET_MS] = value }
    suspend fun setDebounceSeconds(value: Int) = edit { it[Keys.DEBOUNCE_SECONDS] = value }
    suspend fun setSkipWhenScreenOn(value: Boolean) = edit { it[Keys.SKIP_WHEN_SCREEN_ON] = value }
    suspend fun setUnknownSenderDit(value: Boolean) = edit { it[Keys.UNKNOWN_SENDER_DIT] = value }
    suspend fun setVibrationSilenced(value: Boolean) = edit { it[Keys.VIBRATION_SILENCED] = value }

    suspend fun setPackageAllowed(packageName: String, allowed: Boolean) = edit { prefs ->
        val current = (prefs[Keys.ALLOWED_PACKAGES] ?: defaultAllowlist).toMutableSet()
        if (allowed) current.add(packageName) else current.remove(packageName)
        prefs[Keys.ALLOWED_PACKAGES] = current
    }

    /**
     * Records a sender. With [token] null this only seeds the list: a brand-new
     * sender gets auto-derived initials and an already-known one keeps its token.
     * With a token it overrides (empty token = explicit silence for that sender).
     */
    suspend fun upsertSender(displayName: String, token: String? = null) {
        val normalized = normalize(displayName)
        if (normalized.isEmpty()) return
        edit { prefs ->
            val set = (prefs[Keys.MAPPINGS] ?: emptySet()).toMutableSet()
            val existing = set.firstOrNull { decodeMapping(it)?.normalized == normalized }
            if (existing != null && token == null) return@edit
            existing?.let(set::remove)
            val resolvedToken = MorseCode.normalize(token ?: initialsOf(displayName)).take(4)
            set.add(encodeMapping(SenderMapping(displayName.trim(), normalized, resolvedToken)))
            prefs[Keys.MAPPINGS] = set
        }
    }

    suspend fun removeSender(normalized: String) = edit { prefs ->
        val set = (prefs[Keys.MAPPINGS] ?: emptySet()).toMutableSet()
        set.removeAll { decodeMapping(it)?.normalized == normalized }
        prefs[Keys.MAPPINGS] = set
    }

    private suspend fun edit(transform: (MutablePreferences) -> Unit) {
        context.dataStore.edit(transform)
    }

    private fun encodeMapping(mapping: SenderMapping): String =
        listOf(mapping.normalized, mapping.token, mapping.displayName).joinToString(SEPARATOR)

    private fun decodeMapping(raw: String): SenderMapping? {
        val parts = raw.split(SEPARATOR)
        if (parts.size != 3 || parts[0].isEmpty()) return null
        return SenderMapping(displayName = parts[2], normalized = parts[0], token = parts[1])
    }

    companion object {
        private const val SEPARATOR = "\u001F"

        /** Lowercase, strip punctuation and diacritics, collapse whitespace. */
        fun normalize(name: String): String {
            val stripped = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replace(Regex("\\p{Mn}+"), "")
            return stripped.lowercase()
                .replace(Regex("[^a-z0-9 ]"), " ")
                .replace(Regex("\\s+"), " ")
                .trim()
        }

        /** "Mike Reyes" -> "MR". At most three initials. */
        fun initialsOf(name: String): String =
            normalize(name).split(' ')
                .filter { it.isNotEmpty() }
                .take(3)
                .map { it.first().uppercaseChar() }
                .joinToString("")
                .let { MorseCode.normalize(it) }

        fun looksLikePhoneNumber(text: String): Boolean =
            Regex("^\\+?[0-9() .\\-]{4,}$").matches(text.trim())

        /**
         * Resolves a sender name to a Morse token: exact normalized match,
         * then prefix/contains match, then auto-derived initials.
         * Null means "nothing sensible to buzz".
         */
        fun resolveToken(state: AppState, senderName: String): String? {
            val normalized = normalize(senderName)
            if (normalized.isEmpty()) return null
            state.mappings.firstOrNull { it.normalized == normalized }
                ?.let { return it.token.ifEmpty { null } }
            state.mappings.firstOrNull {
                it.normalized.startsWith(normalized) || normalized.startsWith(it.normalized)
            }?.let { return it.token.ifEmpty { null } }
            return initialsOf(senderName).ifEmpty { null }
        }
    }
}
