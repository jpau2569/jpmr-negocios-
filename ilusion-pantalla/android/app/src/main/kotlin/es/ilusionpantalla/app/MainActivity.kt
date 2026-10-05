package es.ilusionpantalla.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import es.ilusionpantalla.app.ui.nav.Navegacion
import es.ilusionpantalla.app.ui.theme.IlusionTema

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { IlusionTema { Navegacion() } }
    }
}
