package es.ilusionpantalla.app

import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import es.ilusionpantalla.wallpaper.VideoWallpaperService

object AplicarWallpaper {
    /** ¿Es ya nuestro live wallpaper el activo? */
    fun esActivo(c: Context): Boolean =
        WallpaperManager.getInstance(c).wallpaperInfo?.component == ComponentName(c, VideoWallpaperService::class.java)

    /**
     * Abre la pantalla NATIVA de confirmación de Android ("Establecer fondo de pantalla").
     * Es el único flujo permitido para live wallpapers; no hay permiso que pedir.
     * Qué pantallas (inicio/bloqueo/ambas) se ofrecen lo decide el sistema/fabricante:
     * la API pública no permite fijar solo el bloqueo con un live wallpaper.
     */
    fun intentConfirmacion(c: Context): Intent =
        Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
            .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, ComponentName(c, VideoWallpaperService::class.java))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** Algunos dispositivos sin soporte del intent directo: caer al selector general. */
    fun intentSelector(): Intent = Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
