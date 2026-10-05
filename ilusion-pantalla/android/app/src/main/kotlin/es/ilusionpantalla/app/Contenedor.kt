package es.ilusionpantalla.app

import android.app.Application
import android.content.Context
import android.media.MediaCodecList
import android.os.Build
import es.ilusionpantalla.catalogo.*
import es.ilusionpantalla.rendimiento.PerfilCalidad
import es.ilusionpantalla.wallpaper.ConfigWallpaper
import java.io.File

/** Inyección manual (sin Hilt todavía: hay un único gráfico pequeño; Hilt entra cuando haya más de una pantalla con estado compartido complejo). */
class Contenedor(private val app: Application) {
    val configurado = BuildConfig.SUPABASE_URL.startsWith("https://") && BuildConfig.SUPABASE_ANON_KEY.isNotBlank()
    val cliente = ClienteSupabase(if (configurado) BuildConfig.SUPABASE_URL else "https://sin-configurar.invalid", BuildConfig.SUPABASE_ANON_KEY)
    val repositorio = RepositorioCatalogo(cliente, AlmacenCatalogo(File(app.filesDir, "catalogo.json")))
    val descargador = Descargador(File(app.filesDir, "wallpapers"))
    val config = ConfigWallpaper(app)
    val favoritos = Favoritos(app)
    val hevcPorHardware: Boolean = soportaHevcPorHardware()

    /** true si la red activa es de datos móviles / de pago (o no hay red). */
    fun redMedida(): Boolean = runCatching { app.getSystemService(android.net.ConnectivityManager::class.java).isActiveNetworkMetered }.getOrDefault(true)

    /** Elimina vídeos antiguos sin tocar el activo ni los favoritos. */
    fun limpiarCache(limiteBytes: Long) {
        val dir = File(app.filesDir, "wallpapers")
        val entradas = dir.listFiles { f -> f.isFile && !f.name.endsWith(".part") }?.map { EntradaCache(it.name, it.length(), it.lastModified()) } ?: return
        val protegidos = buildSet {
            config.archivo?.name?.let(::add)
            favoritos.todos().forEach { slug -> entradas.filter { it.nombre.startsWith(slug + "_") }.forEach { add(it.nombre) } }
        }
        PoliticaCache.aEliminar(entradas, limiteBytes, protegidos).forEach { File(dir, it).delete() }
    }

    companion object {
        fun calidadPara(p: PerfilCalidad) = when (p) {
            PerfilCalidad.AHORRO -> CalidadDescarga.Q720; PerfilCalidad.ESTANDAR -> CalidadDescarga.Q1080
            PerfilCalidad.ALTA -> CalidadDescarga.Q1440; PerfilCalidad.ULTRA -> CalidadDescarga.Q2160
        }
    }
}

private fun soportaHevcPorHardware(): Boolean = runCatching {
    MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.any { ci ->
        !ci.isEncoder && ci.supportedTypes.any { it.equals("video/hevc", true) } && (Build.VERSION.SDK_INT < 29 || ci.isHardwareAccelerated)
    }
}.getOrDefault(false)

class IlusionApp : Application() {
    lateinit var contenedor: Contenedor
    override fun onCreate() { super.onCreate(); contenedor = Contenedor(this) }
}
val Context.contenedor: Contenedor get() = (applicationContext as IlusionApp).contenedor

/** Favoritos locales (por slug). La sincronización con cuenta llega con el login. */
class Favoritos(c: Context) {
    private val sp = c.getSharedPreferences("favoritos", Context.MODE_PRIVATE)
    fun todos(): Set<String> = sp.getStringSet("slugs", emptySet()) ?: emptySet()
    fun alternar(slug: String): Boolean {
        val nuevo = todos().toMutableSet(); val ahora = nuevo.add(slug).also { if (!it) nuevo.remove(slug) }
        sp.edit().putStringSet("slugs", nuevo).apply(); return ahora
    }
}
