package com.claudeigachi.presentation.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.claudeigachi.data.database.ChatMessageEntity
import com.claudeigachi.data.model.Pet
import com.claudeigachi.data.model.PetAnimation
import com.claudeigachi.data.repository.PetRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class PetUiState(
    val pet: Pet? = null,
    val isLoading: Boolean = true,
    val animation: PetAnimation = PetAnimation.IDLE,
    val toastMessage: String? = null,
    val chatMessages: List<ChatMessageEntity> = emptyList(),
    val isChatLoading: Boolean = false,
    val apiKey: String = "",
    val petName: String = "Igachi"
)

class PetViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = PetRepository(application)

    private val _uiState = MutableStateFlow(PetUiState())
    val uiState: StateFlow<PetUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val name = repository.petName.first().ifBlank { "Igachi" }
            val rawPet = repository.getOrCreatePet(name)
            val pet = repository.applyTimeDecay(rawPet)
            repository.savePet(pet)

            _uiState.update { it.copy(pet = pet, isLoading = false, petName = name) }
        }

        viewModelScope.launch {
            repository.pet.filterNotNull().collect { pet ->
                _uiState.update { it.copy(pet = pet) }
            }
        }

        viewModelScope.launch {
            repository.chatMessages.collect { messages ->
                _uiState.update { it.copy(chatMessages = messages) }
            }
        }

        viewModelScope.launch {
            repository.apiKey.collect { key ->
                _uiState.update { it.copy(apiKey = key) }
            }
        }

        // Passive stat decay every 60 seconds while app is open
        viewModelScope.launch {
            while (true) {
                delay(60_000)
                val current = _uiState.value.pet ?: continue
                if (!current.isSleeping && !current.isDead) {
                    val decayed = repository.applyTimeDecay(current)
                    repository.savePet(decayed)
                }
            }
        }
    }

    fun feed() {
        val pet = _uiState.value.pet ?: return
        if (pet.isDead || pet.isSleeping) return
        viewModelScope.launch {
            triggerAnimation(PetAnimation.EATING, 2000)
            val updated = repository.feed(pet)
            showToast(if (updated.hunger > 80) "${pet.name} is stuffed! *burp*" else "${pet.name} munches happily!")
        }
    }

    fun play() {
        val pet = _uiState.value.pet ?: return
        if (pet.isDead || pet.isSleeping || pet.energy < 10) {
            showToast(if (pet.energy < 10) "${pet.name} is too tired to play!" else "Can't do that right now")
            return
        }
        viewModelScope.launch {
            triggerAnimation(PetAnimation.PLAYING, 2500)
            val updated = repository.play(pet)
            showToast(if (updated.happiness > 80) "${pet.name} is overjoyed!" else "${pet.name} had fun!")
        }
    }

    fun toggleSleep() {
        val pet = _uiState.value.pet ?: return
        if (pet.isDead) return
        viewModelScope.launch {
            if (pet.isSleeping) {
                val updated = repository.wake(pet)
                _uiState.update { it.copy(animation = PetAnimation.IDLE) }
                showToast("${updated.name} woke up!")
            } else {
                triggerAnimation(PetAnimation.SLEEPING, Long.MAX_VALUE)
                val updated = repository.sleep(pet)
                showToast("${updated.name} is sleeping... Zzz")
            }
        }
    }

    fun clean() {
        val pet = _uiState.value.pet ?: return
        if (pet.isDead) return
        viewModelScope.launch {
            val updated = repository.clean(pet)
            showToast(if (updated.poopCount == 0 && pet.poopCount > 0) "Cleaned up! ${updated.name} feels fresh!" else "${updated.name} is squeaky clean!")
        }
    }

    fun heal() {
        val pet = _uiState.value.pet ?: return
        if (pet.isDead) return
        viewModelScope.launch {
            val updated = repository.heal(pet)
            showToast(if (pet.isSick) "${updated.name} feels much better!" else "Gave ${updated.name} vitamins!")
        }
    }

    fun sendChatMessage(text: String) {
        val pet = _uiState.value.pet ?: return
        val key = _uiState.value.apiKey
        if (key.isBlank()) {
            showToast("Set your Claude API key in Settings first!")
            return
        }
        if (text.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isChatLoading = true) }
            val result = repository.sendChatMessage(pet, key, text)
            result.onFailure { err ->
                showToast("Chat error: ${err.message?.take(60)}")
            }
            _uiState.update { it.copy(isChatLoading = false) }
        }
    }

    fun saveApiKey(key: String) {
        viewModelScope.launch {
            repository.saveApiKey(key)
            showToast("API key saved!")
        }
    }

    fun renamePet(name: String) {
        val pet = _uiState.value.pet ?: return
        viewModelScope.launch {
            repository.savePet(pet.copy(name = name.trim().take(20)))
            repository.savePetName(name.trim().take(20))
            _uiState.update { it.copy(petName = name) }
            showToast("${name} loves their new name!")
        }
    }

    fun resetPet() {
        viewModelScope.launch {
            val name = _uiState.value.petName.ifBlank { "Igachi" }
            repository.resetPet(name)
            showToast("A new egg has appeared!")
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toastMessage = null) }
    }

    private fun showToast(msg: String) {
        _uiState.update { it.copy(toastMessage = msg) }
    }

    private suspend fun triggerAnimation(anim: PetAnimation, durationMs: Long) {
        _uiState.update { it.copy(animation = anim) }
        if (durationMs != Long.MAX_VALUE) {
            viewModelScope.launch {
                delay(durationMs)
                if (_uiState.value.animation == anim) {
                    _uiState.update { it.copy(animation = PetAnimation.IDLE) }
                }
            }
        }
    }
}
