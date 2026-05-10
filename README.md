# 🐾 Claude-Igachi

A native Android Tamagotchi-style virtual pet powered by **Claude AI** for realistic, personality-driven interactions.

---

## Features

### Classic Tamagotchi Mechanics
- **6 life stages**: Egg → Baby → Child → Teen → Adult → Elder
- **5 stats**: Hunger, Happiness, Health, Energy, Cleanliness
- **Actions**: Feed, Play, Sleep/Wake, Clean, Heal with medicine
- **Real-time decay**: Stats decrease over time, even while the app is closed (WorkManager)
- **Poop mechanic**: Your pet poops every ~90 minutes — clean it up or health suffers
- **Sickness**: Neglect causes illness; use medicine to heal
- **Death**: If you neglect your pet too long, it passes away
- **Background notifications**: Get alerted when your pet needs urgent care
- **Animations**: Idle bob, eating, playing (bounce), sleeping (Zzz), sick (shake), dead, and more

### AI-Powered Chat (Claude API)
- Tap **Talk** to open a full chat screen
- Your pet responds in character based on its **current mood, stats, and life stage**
- Personality evolves naturally through conversations
- Baby pets speak simply; elders speak with wisdom; teens have attitude
- Responses reflect hunger, sickness, happiness, etc. in real-time

### Visual Design
- Pixel-art style creatures drawn entirely in **Compose Canvas** — no image files needed
- Each life stage has a unique body shape, color palette, and features
- Dynamic mood indicators (blush when happy, green tint when sick, X eyes when dead)
- Animated stat bars, action button pulse for sick state, poop badges

---

## Building the APK

### Prerequisites
- **Android Studio** Iguana (2023.2.1) or newer
- **JDK 17+**
- Android SDK with API 34

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/timothy8901/agent-
cd agent-

# 2. Open in Android Studio
# File -> Open -> select this folder

# 3. Build debug APK
./gradlew assembleDebug

# APK will be at:
# app/build/outputs/apk/debug/app-debug.apk
```

### Install on Google Pixel

```bash
# Enable Developer Options + USB Debugging on your Pixel
# Connect via USB

adb install app/build/outputs/apk/debug/app-debug.apk
```

Or in Android Studio: **Run -> Run 'app'** with your Pixel connected.

---

## Setup

1. **Launch the app** - your egg will hatch into a baby after 1 hour
2. **Tap Settings** (gear icon) -> enter your **Anthropic API key**
   - Get one free at console.anthropic.com
3. **Tap Talk** to start chatting with your pet via Claude AI
4. **Keep your pet alive** by feeding, playing, cleaning, and healing it regularly

---

## Gameplay Tips

| Stat        | Depletes   | Action    |
|-------------|------------|-----------|
| Hunger      | ~0.8/min   | Feed      |
| Happiness   | ~0.6/min   | Play      |
| Energy      | ~0.5/min   | Sleep     |
| Cleanliness | ~0.3/min   | Clean     |
| Health      | When sick  | Heal      |

- **Sleep** restores energy (pet won't respond to actions while sleeping)
- **Overfeeding** increases weight; playing reduces it
- **Poop** appears every ~90 min and slowly drains cleanliness — clean it fast!
- Pet dies if health reaches 0 or hunger stays at 0 for over an hour

---

## Tech Stack

- **Kotlin** + **Jetpack Compose** (UI)
- **Room** (pet state persistence)
- **WorkManager** (background decay every 15 min)
- **DataStore** (API key + settings)
- **OkHttp** + **Gson** (Claude API calls)
- **Anthropic Claude claude-sonnet-4-6** (AI pet personality)
- **Compose Canvas** (all pet animations, no image assets needed)

---

## Project Structure

```
app/src/main/java/com/claudeigachi/
├── data/
│   ├── model/          Pet.kt, PetStage, PetMood, PetAnimation
│   ├── database/       Room entities, DAOs, PetDatabase
│   ├── repository/     PetRepository (game logic + API)
│   └── api/            ClaudeApiClient (Anthropic Messages API)
├── presentation/
│   ├── theme/          Material3 theme (light + dark)
│   ├── viewmodel/      PetViewModel (state management)
│   ├── navigation/     NavGraph
│   ├── screens/        MainScreen, ChatScreen, SettingsScreen
│   └── components/     PetCanvas, StatBars, ActionButtons
└── worker/             PetDecayWorker, BootReceiver
```
