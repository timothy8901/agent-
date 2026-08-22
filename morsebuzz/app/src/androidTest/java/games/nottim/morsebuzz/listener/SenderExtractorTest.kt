package games.nottim.morsebuzz.listener

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The adb shell test route (cmd notification post) can't exercise the
 * MessagingStyle path, so this constructs one directly (spec §4).
 */
@RunWith(AndroidJUnit4::class)
class SenderExtractorTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun builder() = NotificationCompat.Builder(context, "test")
        .setSmallIcon(android.R.drawable.ic_dialog_info)

    @Test
    fun messagingStylePersonNameWins() {
        val mike = Person.Builder().setName("Mike Reyes").build()
        val me = Person.Builder().setName("Me").build()
        val style = NotificationCompat.MessagingStyle(me)
            .addMessage("hey", 123L, mike)
        val notification = builder()
            .setContentTitle("Some conversation title")
            .setStyle(style)
            .build()

        assertEquals("Mike Reyes", SenderExtractor.senderOf(notification))
    }

    @Test
    fun titleFallbackWhenNoMessagingStyle() {
        val notification = builder().setContentTitle("Alice").build()
        assertEquals("Alice", SenderExtractor.senderOf(notification))
    }

    @Test
    fun blankSenderIsNull() {
        val notification = builder().setContentTitle("   ").build()
        assertNull(SenderExtractor.senderOf(notification))
    }

    @Test
    fun noSenderIsNull() {
        assertNull(SenderExtractor.senderOf(builder().build()))
    }
}
