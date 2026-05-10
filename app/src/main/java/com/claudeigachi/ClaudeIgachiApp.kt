package com.claudeigachi

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.*
import com.claudeigachi.worker.PetDecayWorker
import java.util.concurrent.TimeUnit

class ClaudeIgachiApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        schedulePetDecayWorker()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_PET_NEEDS,
                    "Pet Needs",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Alerts when your pet needs attention" }
            )
        }
    }

    private fun schedulePetDecayWorker() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .build()

        val request = PeriodicWorkRequestBuilder<PetDecayWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setInitialDelay(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            PetDecayWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }

    companion object {
        const val CHANNEL_PET_NEEDS = "pet_needs"
    }
}
