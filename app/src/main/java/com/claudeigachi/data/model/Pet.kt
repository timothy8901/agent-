package com.claudeigachi.data.model

data class Pet(
    val id: Long = 1,
    val name: String = "Igachi",
    val stage: PetStage = PetStage.EGG,
    val hunger: Int = 80,       // 0=starving, 100=full
    val happiness: Int = 80,
    val health: Int = 100,
    val energy: Int = 80,
    val cleanliness: Int = 100,
    val weight: Int = 5,        // increases with feeding
    val age: Long = 0,          // minutes alive
    val lastUpdated: Long = System.currentTimeMillis(),
    val isSick: Boolean = false,
    val isSleeping: Boolean = false,
    val isDead: Boolean = false,
    val poopCount: Int = 0,     // classic tamagotchi poop mechanic
    val totalMeals: Int = 0,
    val totalPlaySessions: Int = 0,
    val personalityTraits: String = ""  // AI-assigned personality adjectives
) {
    val mood: PetMood get() = when {
        isDead -> PetMood.DEAD
        isSleeping -> PetMood.SLEEPING
        isSick -> PetMood.SICK
        hunger < 20 -> PetMood.HUNGRY
        energy < 20 -> PetMood.TIRED
        happiness < 20 -> PetMood.SAD
        poopCount > 0 -> PetMood.DIRTY
        hunger > 60 && happiness > 60 && health > 60 && energy > 60 -> PetMood.HAPPY
        else -> PetMood.NEUTRAL
    }

    val isNeglected: Boolean get() =
        hunger < 10 || happiness < 10 || health < 10 || energy < 10

    val overallHealth: Int get() =
        (hunger + happiness + health + energy + cleanliness) / 5
}

enum class PetStage(val displayName: String, val minAgeMinutes: Long) {
    EGG("Egg", 0),
    BABY("Baby", 60),
    CHILD("Child", 360),
    TEEN("Teen", 720),
    ADULT("Adult", 1440),
    ELDER("Elder", 4320)
}

enum class PetMood {
    HAPPY, NEUTRAL, SAD, HUNGRY, SICK, TIRED, DIRTY, SLEEPING, DEAD
}

enum class PetAnimation {
    IDLE, EATING, PLAYING, SLEEPING, CELEBRATING, SICK, POOPING, DEAD, HATCHING
}
