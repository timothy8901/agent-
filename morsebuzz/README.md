# MorseBuzz

Android app that vibrates the sender's initials in Morse code when a
notification arrives, so you can tell who's messaging you without looking at
your phone. Built for modern Pixels (LRA haptics with amplitude control), but
feature-detects and degrades gracefully.

## How it works

- A `NotificationListenerService` watches an allowlist of source apps
  (defaults: your SMS app and dialer). It reads only the **sender name** —
  never the message body.
- The sender resolves to a short token (auto-derived initials, e.g.
  "Mike Reyes" → "MR", user-overridable, max 3–4 chars) and plays as
  haptic-scale Morse: 130 ms dits by default, not the uselessly-short
  textbook 60 ms. Dits render soft, dahs strong when the motor supports
  amplitude control.
- Repeats from the same sender within a quiet window (default 20 s) are
  suppressed; colliding buzzes are dropped, never queued. By default nothing
  plays while the screen is on and unlocked.

## The one manual step that matters

Android won't let MorseBuzz suppress the *source app's* own vibration. If you
skip this, you'll feel a generic buzz and then the Morse, which ruins it. For
each source app: Settings tab → "Silence" → turn that app's notification
vibration off. The in-app setup checklist walks through it.

## Building

```
cd morsebuzz
./gradlew :morse:test          # pure-Kotlin encoder tests, no Android SDK needed
./gradlew :app:assembleDebug   # needs the Android SDK (CI builds this too)
adb install app/build/outputs/apk/debug/app-debug.apk
```

CI (`.github/workflows/morsebuzz-android.yml`) runs the encoder tests, builds
the debug APK, and uploads it as the `morsebuzz-debug-apk` artifact.

## Testing without spamming real people

```
adb shell cmd notification post -S bigtext -t 'Mike Reyes' morsebuzz_test 'test body'
```

Note: the shell route can't produce a `MessagingStyle` notification; that
path is covered by the instrumented test in
`app/src/androidTest/.../SenderExtractorTest.kt`
(`./gradlew :app:connectedDebugAndroidTest` with a device attached). Remember
to add the shell package to the allowlist first if you use the adb route —
or just use the "Feel any text" field on the Settings tab.

## Project layout

```
morse/   pure Kotlin, zero Android imports: Morse table, encoder, waveform builder + unit tests
app/     Android app: vibrator wrapper, notification listener, DataStore mapping store, Compose UI
```

Known behavior: vibrations are tagged `USAGE_NOTIFICATION`, so Do Not Disturb
suppresses them by design.
