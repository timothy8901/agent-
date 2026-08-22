package games.nottim.morsebuzz.listener

import android.app.Notification
import androidx.core.app.NotificationCompat

/**
 * Pulls the sender's display name out of a notification, in the spec's
 * priority order: MessagingStyle Person name (most reliable for modern
 * messaging apps), then conversation title, then plain title.
 */
object SenderExtractor {

    fun senderOf(notification: Notification): String? {
        val style = NotificationCompat.MessagingStyle
            .extractMessagingStyleFromNotification(notification)
        style?.messages?.lastOrNull()?.person?.name
            ?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { return it }

        val extras = notification.extras
        for (key in listOf(
            NotificationCompat.EXTRA_CONVERSATION_TITLE,
            NotificationCompat.EXTRA_TITLE,
        )) {
            extras.getCharSequence(key)?.toString()?.trim()
                ?.takeIf { it.isNotEmpty() }
                ?.let { return it }
        }
        return null
    }
}
