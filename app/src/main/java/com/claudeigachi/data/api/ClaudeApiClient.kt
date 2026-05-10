package com.claudeigachi.data.api

import com.claudeigachi.data.model.Pet
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class ClaudeMessage(val role: String, val content: String)

data class ClaudeRequest(
    val model: String = "claude-sonnet-4-6",
    val max_tokens: Int = 300,
    val system: String,
    val messages: List<ClaudeMessage>
)

data class ClaudeResponse(
    val content: List<ContentBlock>?,
    val error: ErrorBlock?
) {
    data class ContentBlock(val type: String, val text: String?)
    data class ErrorBlock(val type: String, val message: String)
}

class ClaudeApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    suspend fun chat(
        apiKey: String,
        pet: Pet,
        conversationHistory: List<ClaudeMessage>,
        userMessage: String
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val systemPrompt = buildSystemPrompt(pet)
            val messages = conversationHistory.takeLast(10) + ClaudeMessage("user", userMessage)

            val requestBody = gson.toJson(ClaudeRequest(
                system = systemPrompt,
                messages = messages
            )).toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .header("x-api-key", apiKey)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: error("Empty response")

            if (!response.isSuccessful) {
                val err = gson.fromJson(body, ClaudeResponse::class.java)
                error(err.error?.message ?: "API error ${response.code}")
            }

            gson.fromJson(body, ClaudeResponse::class.java)
                .content?.firstOrNull { it.type == "text" }?.text
                ?: error("No text in response")
        }
    }

    private fun buildSystemPrompt(pet: Pet): String {
        val moodDesc = pet.mood.name.lowercase().replaceFirstChar { it.uppercase() }
        val stageDesc = pet.stage.displayName
        val traits = pet.personalityTraits.ifBlank { "curious, playful, affectionate" }

        return """
You are ${pet.name}, a virtual Tamagotchi-style pet at the $stageDesc life stage.
Your personality: $traits.
Current mood: $moodDesc.
Stats — Hunger: ${pet.hunger}/100, Happiness: ${pet.happiness}/100, Health: ${pet.health}/100, Energy: ${pet.energy}/100, Cleanliness: ${pet.cleanliness}/100.
Age: ${pet.age / 60} hours old. Weight: ${pet.weight}.${if (pet.isSick) "\nYou are feeling sick right now." else ""}${if (pet.isSleeping) "\nYou are sleepy." else ""}${if (pet.poopCount > 0) "\nThere is poop nearby and you don't like it." else ""}

Respond as this creature would — in short, expressive, endearing messages (1-3 sentences max).
Use simple vocabulary appropriate to your life stage. Express your current mood and stats naturally.
You can use emoticons and sound effects (like *munch munch* or *yawn*). Never break character.
If you're a baby or egg, be very simple/primitive. If elder, be wise and nostalgic.
""".trimIndent()
    }
}
