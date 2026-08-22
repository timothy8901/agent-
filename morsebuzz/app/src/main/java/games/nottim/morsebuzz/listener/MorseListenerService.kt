package games.nottim.morsebuzz.listener

import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.content.ComponentName
import android.content.pm.PackageManager
import android.net.Uri
import android.os.PowerManager
import android.os.SystemClock
import android.provider.ContactsContract
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import games.nottim.morsebuzz.data.AppState
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.vibe.Buzzer
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class MorseListenerService : NotificationListenerService() {

    private lateinit var store: MappingStore
    private lateinit var buzzer: Buzzer
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Sender -> last buzz timestamp, for the debounce window. In-memory on purpose. */
    private val lastBuzzAt = ConcurrentHashMap<String, Long>()

    /** While a buzz is playing, colliding buzzes are dropped - never queued or overlapped. */
    @Volatile
    private var buzzingUntil = 0L

    /** Kept warm so onNotificationPosted never blocks on disk. */
    @Volatile
    private var latestState: AppState? = null

    override fun onCreate() {
        super.onCreate()
        store = MappingStore(applicationContext)
        buzzer = Buzzer(applicationContext)
        scope.launch { store.state.collect { latestState = it } }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onListenerDisconnected() {
        // The system can kill the listener; ask to be reattached.
        requestRebind(ComponentName(this, MorseListenerService::class.java))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return
        if (sbn.isOngoing) return
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val state = latestState ?: runBlocking { store.state.first() }
        if (sbn.packageName !in state.settings.allowedPackages) return

        var sender = SenderExtractor.senderOf(sbn.notification) ?: return
        if (MappingStore.looksLikePhoneNumber(sender)) {
            lookupContactName(sender)?.let { sender = it }
        }

        // Seed the senders list even when we end up not buzzing.
        val seenName = sender
        scope.launch { store.upsertSender(seenName) }

        if (state.settings.skipWhenScreenOn && isScreenOnAndUnlocked()) return

        val token = MappingStore.resolveToken(state, sender)
            ?: if (state.settings.unknownSenderDit) "E" else return
        val waveform = buzzer.waveformFor(token, state.settings)
        if (waveform.isEmpty) return

        val now = SystemClock.elapsedRealtime()
        if (now < buzzingUntil) return // collision: drop the second buzz

        val debounceKey = MappingStore.normalize(sender).ifEmpty { "?" }
        val debounceMs = state.settings.debounceSeconds * 1000L
        lastBuzzAt[debounceKey]?.let { if (now - it < debounceMs) return }

        lastBuzzAt[debounceKey] = now
        buzzingUntil = now + waveform.totalMs
        buzzer.buzz(waveform)
    }

    private fun isScreenOnAndUnlocked(): Boolean {
        val power = getSystemService(PowerManager::class.java)
        val keyguard = getSystemService(KeyguardManager::class.java)
        return power?.isInteractive == true && keyguard?.isKeyguardLocked == false
    }

    /** Optional READ_CONTACTS path: resolve a raw number to a contact name. */
    private fun lookupContactName(number: String): String? {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }
        return try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(number),
            )
            contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getString(0)?.trim()?.takeIf { it.isNotEmpty() }
                } else {
                    null
                }
            }
        } catch (_: Exception) {
            null
        }
    }
}
