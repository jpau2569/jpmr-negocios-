package es.ilusionpantalla.wallpaper

import android.app.KeyguardManager
import android.content.*
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.service.wallpaper.WallpaperService
import android.view.Surface
import android.view.SurfaceHolder
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import es.ilusionpantalla.rendimiento.*

/**
 * Live wallpaper de vídeo en bucle, SIN audio.
 *
 * Ciclo de vida (lo importante):
 *  - El reproductor existe solo mientras hay Surface. Se pausa (no se destruye) al ocultarse.
 *  - Cada cambio de estado (visibilidad, pantalla, batería, ahorro, térmico, ajustes) pasa por
 *    PoliticaRendimiento.decidir(); aquí no hay reglas de negocio duplicadas.
 *  - Todo receptor se registra en onCreate y se libera en onDestroy: sin fugas tras reinicios.
 *
 * Límite honesto: ExoPlayer no recorta FPS por sí mismo. El techo de FPS se aplica ELIGIENDO la
 * variante del vídeo (fps ≤ techo, ver SelectorArchivo) y con Surface.setFrameRate (API 30+) como pista al sistema.
 */
class VideoWallpaperService : WallpaperService() {
    override fun onCreateEngine(): Engine = MotorVideo()

    private inner class MotorVideo : Engine() {
        private val config = ConfigWallpaper(applicationContext)
        private val pm = getSystemService(PowerManager::class.java)
        private val km = getSystemService(KeyguardManager::class.java)
        private var player: ExoPlayer? = null
        private var surface: Surface? = null
        private var visible = false
        private var archivoCargado: String? = null
        private lateinit var adaptativa: CalidadAdaptativa

        private val receptor = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) = reevaluar()
        }
        private val alCambiarAjustes = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            adaptativa = CalidadAdaptativa(config.ajustes.perfil); reevaluar()
        }
        private val escuchaTermica = if (Build.VERSION.SDK_INT >= 29)
            PowerManager.OnThermalStatusChangedListener { reevaluar() } else null

        override fun onCreate(sh: SurfaceHolder) {
            super.onCreate(sh)
            adaptativa = CalidadAdaptativa(config.ajustes.perfil)
            val f = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_USER_PRESENT)
                addAction(Intent.ACTION_BATTERY_CHANGED); addAction(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
                addAction(Intent.ACTION_POWER_CONNECTED); addAction(Intent.ACTION_POWER_DISCONNECTED)
            }
            // Receptor interno al proceso → RECEIVER_NOT_EXPORTED (obligatorio desde API 34 para no-sistema)
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(receptor, f, Context.RECEIVER_NOT_EXPORTED) else registerReceiver(receptor, f)
            config.alCambiar(alCambiarAjustes)
            if (Build.VERSION.SDK_INT >= 29) pm.addThermalStatusListener(escuchaTermica!!)
        }

        override fun onSurfaceCreated(h: SurfaceHolder) { super.onSurfaceCreated(h); surface = h.surface; reevaluar() }
        override fun onSurfaceChanged(h: SurfaceHolder, f: Int, w: Int, hh: Int) { super.onSurfaceChanged(h, f, w, hh); reevaluar() }
        override fun onSurfaceDestroyed(h: SurfaceHolder) { liberarReproductor(); surface = null; super.onSurfaceDestroyed(h) }
        override fun onVisibilityChanged(v: Boolean) { visible = v; reevaluar() }

        override fun onDestroy() {
            runCatching { unregisterReceiver(receptor) }
            config.dejarDeEscuchar(alCambiarAjustes)
            if (Build.VERSION.SDK_INT >= 29) pm.removeThermalStatusListener(escuchaTermica!!)
            liberarReproductor()
            super.onDestroy()
        }

        private fun estado(): EstadoDispositivo {
            val bat = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val nivel = bat?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val escala = bat?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
            val pct = if (nivel >= 0 && escala > 0) (nivel * 100 / escala).coerceIn(0, 100) else 100
            val plug = bat?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
            val termico = if (Build.VERSION.SDK_INT >= 29) when (pm.currentThermalStatus) {
                PowerManager.THERMAL_STATUS_SEVERE, PowerManager.THERMAL_STATUS_CRITICAL,
                PowerManager.THERMAL_STATUS_EMERGENCY, PowerManager.THERMAL_STATUS_SHUTDOWN -> Termico.SEVERO
                PowerManager.THERMAL_STATUS_MODERATE -> Termico.MODERADO
                else -> Termico.NORMAL
            } else Termico.NORMAL
            return EstadoDispositivo(
                bateriaPct = pct, cargando = plug != 0, ahorroSistema = pm.isPowerSaveMode, termico = termico,
                pantallaEncendida = pm.isInteractive, pantallaBloqueada = km.isKeyguardLocked && !isPreview,
                wallpaperVisible = visible,
            )
        }

        private fun reevaluar() {
            when (val d = PoliticaRendimiento.decidir(estado(), config.ajustes)) {
                is Decision.Pausar -> player?.pause()
                is Decision.Reproducir -> reproducir(d)
            }
        }

        private fun reproducir(d: Decision.Reproducir) {
            val s = surface?.takeIf { it.isValid } ?: return
            val archivo = config.archivo ?: return          // sin archivo local no hay nada que pintar
            val p = player ?: crearReproductor(s).also { player = it }
            if (archivoCargado != archivo.absolutePath) {
                p.setMediaItem(MediaItem.fromUri(Uri.fromFile(archivo))); p.prepare(); archivoCargado = archivo.absolutePath
            }
            if (Build.VERSION.SDK_INT >= 30) runCatching { s.setFrameRate(d.fps.toFloat(), Surface.FRAME_RATE_COMPATIBILITY_DEFAULT) }
            p.playWhenReady = true
        }

        private fun crearReproductor(s: Surface) = ExoPlayer.Builder(applicationContext).build().apply {
            repeatMode = Player.REPEAT_MODE_ALL
            volume = 0f                                  // regla de producto: nunca audio por defecto
            videoScalingMode = C.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
            setVideoSurface(s)
            addListener(object : Player.Listener {
                override fun onPlayerError(e: androidx.media3.common.PlaybackException) {
                    // Archivo corrupto o códec no soportado: no reintentar en bucle; se queda en negro/último frame.
                    archivoCargado = null
                }
            })
        }

        private fun liberarReproductor() { player?.release(); player = null; archivoCargado = null }
    }
}
