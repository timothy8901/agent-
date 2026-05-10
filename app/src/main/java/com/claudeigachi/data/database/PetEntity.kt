package com.claudeigachi.data.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.claudeigachi.data.model.Pet
import com.claudeigachi.data.model.PetStage

@Entity(tableName = "pets")
data class PetEntity(
    @PrimaryKey val id: Long = 1,
    val name: String,
    val stage: String,
    val hunger: Int,
    val happiness: Int,
    val health: Int,
    val energy: Int,
    val cleanliness: Int,
    val weight: Int,
    val age: Long,
    val lastUpdated: Long,
    val isSick: Boolean,
    val isSleeping: Boolean,
    val isDead: Boolean,
    val poopCount: Int,
    val totalMeals: Int,
    val totalPlaySessions: Int,
    val personalityTraits: String
)

fun PetEntity.toPet() = Pet(
    id = id, name = name,
    stage = PetStage.valueOf(stage),
    hunger = hunger, happiness = happiness, health = health,
    energy = energy, cleanliness = cleanliness, weight = weight,
    age = age, lastUpdated = lastUpdated,
    isSick = isSick, isSleeping = isSleeping, isDead = isDead,
    poopCount = poopCount, totalMeals = totalMeals,
    totalPlaySessions = totalPlaySessions,
    personalityTraits = personalityTraits
)

fun Pet.toEntity() = PetEntity(
    id = id, name = name, stage = stage.name,
    hunger = hunger, happiness = happiness, health = health,
    energy = energy, cleanliness = cleanliness, weight = weight,
    age = age, lastUpdated = lastUpdated,
    isSick = isSick, isSleeping = isSleeping, isDead = isDead,
    poopCount = poopCount, totalMeals = totalMeals,
    totalPlaySessions = totalPlaySessions,
    personalityTraits = personalityTraits
)
