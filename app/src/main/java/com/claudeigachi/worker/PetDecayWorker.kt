package com.claudeigachi.worker

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.claudeigachi.ClaudeIgachiApp
import com.claudeigachi.MainActivity
import com.claudeigachi.data.database.PetDatabase
import com.claudeigachi.data.database.toPet
import com.claudeigachi.data.database.toEntity
import com.claudeigachi.data.model.PetMood
import com.claudeigachi.data.repository.PetRepository

class PetDecayWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val repo = PetRepository(context)
        val pet = repo.getOrCreatePet()

        if (pet.isDead) return Result.success()

        val decayed = repo.applyTimeDecay(pet)
        repo.savePet(decayed)

        // Notify if pet needs urgent attention
        val urgentNeeds = buildUrgentNeeds(decayed.hunger, decayed.happiness,
            decayed.health, decayed.energy, decayed.cleanliness, decayed.isSick)

        if (urgentNeeds.isNotEmpty()) {
            sendNotification(decayed.name, urgentNeeds.first())
        }

        return Result.success()
    }

    private fun buildUrgentNeeds(
        hunger: Int, happiness: Int, health: Int,
        energy: Int, cleanliness: Int, isSick: Boolean
    ): List<String> = buildList {
        if (hunger < 15) add("${getContext().getString(android.R.string.ok).let { "" }}is starving! Feed me! 🍖")
        if (health < 15 || isSick) add("is sick and needs medicine! 💊")
        if (happiness < 15) add("is really sad! Come play! 🎮")
        if (energy < 10) add("is exhausted! Let me sleep! 💤")
        if (cleanliness < 10) add("needs a bath! 🚿")
    }

    private fun sendNotification(petName: String, message: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, ClaudeIgachiApp.CHANNEL_PET_NEEDS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("$petName needs you!")
            .setContentText("$petName $message")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val WORK_NAME = "pet_decay_work"
        private const val NOTIFICATION_ID = 1001
    }
}
