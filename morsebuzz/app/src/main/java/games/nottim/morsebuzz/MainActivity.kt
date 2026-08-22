package games.nottim.morsebuzz

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import games.nottim.morsebuzz.data.MappingStore
import games.nottim.morsebuzz.ui.MorseBuzzApp
import games.nottim.morsebuzz.ui.MorseBuzzTheme
import games.nottim.morsebuzz.vibe.Buzzer

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = MappingStore(applicationContext)
        val buzzer = Buzzer(applicationContext)
        setContent {
            MorseBuzzTheme {
                MorseBuzzApp(store = store, buzzer = buzzer)
            }
        }
    }
}
