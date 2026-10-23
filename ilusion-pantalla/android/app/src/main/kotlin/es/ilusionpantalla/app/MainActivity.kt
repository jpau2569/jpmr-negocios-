package es.ilusionpantalla.app

import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import es.ilusionpantalla.analitica.Evento
import es.ilusionpantalla.analitica.PerfilEv
import es.ilusionpantalla.app.ui.nav.Navegacion
import es.ilusionpantalla.app.ui.pantallas.PantallaConsentimiento
import es.ilusionpantalla.app.ui.theme.IlusionTema
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var preguntar by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val c = contenedor
        preguntar = c.consentimiento.debePreguntar
        if (savedInstanceState == null) registrarApertura()
        setContent {
            IlusionTema {
                if (preguntar) PantallaConsentimiento(
                    alAceptar = { c.privacidad { conceder() }; preguntar = false },
                    alRechazar = { c.privacidad { denegar() }; preguntar = false },
                ) else Navegacion()
            }
        }
    }

    override fun onResume() { super.onResume(); registrarActivacion() }
    override fun onStop() { super.onStop(); sincronizar() }
    override fun onStart() { super.onStart(); sincronizar() }

    private fun sincronizar() { lifecycleScope.launch(Dispatchers.IO) { contenedor.sincronizarAnalitica() } }

    private fun registrarApertura() {
        val sp = getSharedPreferences("analitica_estado", MODE_PRIVATE)
        val primera = !sp.getBoolean("ya_abierta", false); sp.edit().putBoolean("ya_abierta", true).apply()
        contenedor.evento(Evento.AppAbierta(BuildConfig.VERSION_NAME, Build.VERSION.SDK_INT.coerceIn(21, 99), primera))
    }

    /** «Activado» = el sistema confirma que NUESTRO wallpaper es el activo (no basta con abrir el diálogo). Una vez por fondo. */
    private fun registrarActivacion() {
        val c = contenedor
        val archivo = c.config.archivo ?: return
        if (!AplicarWallpaper.esActivo(this)) return
        val slug = archivo.name.substringBeforeLast('_')
        val sp = getSharedPreferences("analitica_estado", MODE_PRIVATE)
        if (sp.getString("ultimo_activado", null) == slug) return
        sp.edit().putString("ultimo_activado", slug).apply()
        val perfil = runCatching { PerfilEv.valueOf(c.config.ajustes.perfil.name) }.getOrDefault(PerfilEv.ESTANDAR)
        c.evento(Evento.WallpaperActivado(slug, perfil))
    }
}
