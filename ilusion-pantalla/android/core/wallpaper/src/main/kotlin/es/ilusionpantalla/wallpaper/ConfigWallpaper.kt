package es.ilusionpantalla.wallpaper

import android.content.Context
import es.ilusionpantalla.rendimiento.Ajustes
import es.ilusionpantalla.rendimiento.PerfilCalidad
import java.io.File

/**
 * Puente app → servicio. El servicio vive en el mismo proceso, pero se arranca solo (reinicio,
 * cambio de orientación…) sin que la UI exista, así que lee de SharedPreferences, que es síncrono y barato.
 * Solo se guarda una RUTA LOCAL: el servicio nunca descarga ni toca la red.
 */
class ConfigWallpaper(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("wallpaper_activo", Context.MODE_PRIVATE)

    var archivo: File?
        get() = sp.getString(K_ARCHIVO, null)?.let(::File)?.takeIf { it.isFile && it.length() > 0 }
        set(v) = sp.edit().putString(K_ARCHIVO, v?.absolutePath).apply()

    var ajustes: Ajustes
        get() = Ajustes(
            perfil = runCatching { PerfilCalidad.valueOf(sp.getString(K_PERFIL, "")!!) }.getOrDefault(PerfilCalidad.ESTANDAR),
            fpsLimite = sp.getInt(K_FPS, 0).takeIf { it in listOf(24, 30, 60) },
            calidadAdaptativa = sp.getBoolean(K_ADAPT, true),
            pausarBateriaBajaPct = sp.getInt(K_BAT, 15).coerceIn(0, 50),
            pausarEnAhorroSistema = sp.getBoolean(K_AHORRO, true),
            soloWifi = sp.getBoolean(K_WIFI, true),
        )
        set(a) = sp.edit()
            .putString(K_PERFIL, a.perfil.name).putInt(K_FPS, a.fpsLimite ?: 0)
            .putBoolean(K_ADAPT, a.calidadAdaptativa).putInt(K_BAT, a.pausarBateriaBajaPct)
            .putBoolean(K_AHORRO, a.pausarEnAhorroSistema).putBoolean(K_WIFI, a.soloWifi).apply()

    fun alCambiar(l: android.content.SharedPreferences.OnSharedPreferenceChangeListener) = sp.registerOnSharedPreferenceChangeListener(l)
    fun dejarDeEscuchar(l: android.content.SharedPreferences.OnSharedPreferenceChangeListener) = sp.unregisterOnSharedPreferenceChangeListener(l)

    private companion object {
        const val K_ARCHIVO = "archivo"; const val K_PERFIL = "perfil"; const val K_FPS = "fps"
        const val K_ADAPT = "adaptativa"; const val K_BAT = "bateria"; const val K_AHORRO = "ahorro"; const val K_WIFI = "wifi"
    }
}
