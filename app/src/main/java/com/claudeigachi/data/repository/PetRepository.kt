package com.claudeigachi.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.claudeigachi.data.api.ClaudeApiClient
import com.claudeigachi.data.api.ClaudeMessage
import com.claudeigachi.data.database.ChatMessageEntity
import com.claudeigachi.data.database.PetDatabase
import com.claudeigachi.data.database.toPet
import com.claudeigachi.data.database.toEntity
import com.claudeigachi.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlin.math.max
import kotlin.math.min

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

class PetRepository(private val context: Context) {

    private val db = PetDatabase.getInstance(context)
    private val petDao = db.petDao()
    private val chatDao = db.chatDao()
    private val claudeClient = ClaudeApiClient()

    private val apiKeyPref = stringPreferencesKey("claude_api_key")
    private val petNamePref = stringPreferencesKey("pet_name")

    val pet: Flow<Pet?> = petDao.observePet().map { it?.toPet() }
    val chatMessages: Flow<List<ChatMessageEntity>> = chatDao.observeMessages()

    val apiKey: Flow<String> = context.dataStore.data.map { it[apiKeyPref] ?: "" }
    val petName: Flow<String> = context.dataStore.data.map { it[petNamePref] ?: "Igachi" }

    suspend fun saveApiKey(key: String) {
        context.dataStore.edit { it[apiKeyPref] = key }
    }

    suspend fun savePetName(name: String) {
        context.dataStore.edit { it[petNamePref] = name }
    }

    suspend fun getOrCreatePet(name: String = "Igachi"): Pet {
        return petDao.getPet()?.toPet() ?: Pet(name = name).also {
            petDao.savePet(it.toEntity())
        }
    }

    suspend fun savePet(pet: Pet) {
        petDao.savePet(pet.toEntity())
    }

    suspend fun resetPet(name: String) {
        petDao.deleteAll()
        chatDao.pruneOldMessages()
        petDao.savePet(Pet(name = name).toEntity())
    }

    suspend fun applyTimeDecay(pet: Pet): Pet {
        val now = System.currentTimeMillis()
        val elapsedMinutes = ((now - pet.lastUpdated) / 60_000L).coerceIn(0, 480)
        if (elapsedMinutes == 0L) return pet

        if (pet.isDead || pet.isSleeping) {
            // sleeping restores energy slowly
            val energyGain = if (pet.isSleeping) (elapsedMinutes * 2).toInt() else 0
            return pet.copy(
                energy = min(100, pet.energy + energyGain),
                age = pet.age + elapsedMinutes,
                lastUpdated = now,
                isSleeping = if (pet.isSleeping && pet.energy >= 100) false else pet.isSleeping
            )
        }

        val hungerLoss = (elapsedMinutes * 0.8).toInt()
        val happinessLoss = (elapsedMinutes * 0.6).toInt()
        val energyLoss = (elapsedMinutes * 0.5).toInt()
        val cleanlinessLoss = (elapsedMinutes * 0.3).toInt()

        val newHunger = max(0, pet.hunger - hungerLoss)
        val newHappiness = max(0, pet.happiness - happinessLoss)
        val newEnergy = max(0, pet.energy - energyLoss)
        val newCleanliness = max(0, pet.cleanliness - cleanlinessLoss)
        val newAge = pet.age + elapsedMinutes

        // random poop every ~90 minutes
        val newPoopCount = if (elapsedMinutes >= 90 && pet.poopCount < 3) pet.poopCount + 1 else pet.poopCount

        // sickness: low health + dirty for too long
        val newSick = pet.isSick || (newCleanliness < 10 && newHunger < 10)

        // health degrades when sick or very hungry
        val healthLoss = when {
            newSick -> (elapsedMinutes * 0.4).toInt()
            newHunger < 20 -> (elapsedMinutes * 0.2).toInt()
            else -> 0
        }
        val newHealth = max(0, pet.health - healthLoss)

        val newStage = PetStage.entries.lastOrNull { it.minAgeMinutes <= newAge } ?: PetStage.EGG
        val isDead = newHealth == 0 || (newHunger == 0 && elapsedMinutes > 60)

        return pet.copy(
            hunger = newHunger, happiness = newHappiness,
            health = newHealth, energy = newEnergy, cleanliness = newCleanliness,
            age = newAge, lastUpdated = now, isSick = newSick,
            poopCount = newPoopCount, stage = newStage, isDead = isDead
        )
    }

    suspend fun feed(pet: Pet): Pet {
        val updated = pet.copy(
            hunger = min(100, pet.hunger + 30),
            weight = pet.weight + 1,
            totalMeals = pet.totalMeals + 1,
            lastUpdated = System.currentTimeMillis()
        )
        savePet(updated)
        return updated
    }

    suspend fun play(pet: Pet): Pet {
        val updated = pet.copy(
            happiness = min(100, pet.happiness + 25),
            energy = max(0, pet.energy - 15),
            weight = max(1, pet.weight - 1),
            totalPlaySessions = pet.totalPlaySessions + 1,
            lastUpdated = System.currentTimeMillis()
        )
        savePet(updated)
        return updated
    }

    suspend fun sleep(pet: Pet): Pet {
        val updated = pet.copy(isSleeping = true, lastUpdated = System.currentTimeMillis())
        savePet(updated)
        return updated
    }

    suspend fun wake(pet: Pet): Pet {
        val updated = pet.copy(isSleeping = false, lastUpdated = System.currentTimeMillis())
        savePet(updated)
        return updated
    }

    suspend fun clean(pet: Pet): Pet {
        val updated = pet.copy(
            cleanliness = 100,
            poopCount = 0,
            lastUpdated = System.currentTimeMillis()
        )
        savePet(updated)
        return updated
    }

    suspend fun heal(pet: Pet): Pet {
        val updated = pet.copy(
            health = min(100, pet.health + 40),
            isSick = false,
            lastUpdated = System.currentTimeMillis()
        )
        savePet(updated)
        return updated
    }

    suspend fun sendChatMessage(pet: Pet, apiKey: String, userText: String): Result<String> {
        chatDao.insertMessage(ChatMessageEntity(role = "user", content = userText))

        val history = chatDao.getRecentMessages(20).reversed().map {
            ClaudeMessage(role = it.role, content = it.content)
        }

        val result = claudeClient.chat(apiKey, pet, history, userText)
        result.onSuccess { reply ->
            chatDao.insertMessage(ChatMessageEntity(role = "assistant", content = reply))
            chatDao.pruneOldMessages()
        }
        return result
    }
}
