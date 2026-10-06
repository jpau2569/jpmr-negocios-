package es.ilusionpantalla.catalogo

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Metricas(val descargas: Long = 0, val aplicaciones: Long = 0, val favoritos: Long = 0)

/** Fila de la vista `catalogo_publico` (solo campos públicos; sin rutas de vídeo). */
@Serializable
data class Wallpaper(
    val id: String,
    val slug: String,
    val titulo: String,
    val descripcion: String? = null,
    @SerialName("categoria_slug") val categoriaSlug: String? = null,
    @SerialName("categoria_nombre") val categoriaNombre: String? = null,
    val etiquetas: List<String> = emptyList(),
    val orientacion: String = "vertical",
    @SerialName("duracion_s") val duracionS: Double? = null,
    val resolucion: String? = null,
    @SerialName("fps_recomendado") val fpsRecomendado: Int? = null,
    @SerialName("perfil_rendimiento") val perfilRendimiento: String = "estandar",
    @SerialName("tamano_archivo_bytes") val tamanoBytes: Long? = null,
    @SerialName("consumo_estimado") val consumoEstimado: String? = null,
    @SerialName("color_dominante") val colorDominante: String? = null,
    val estilo: String? = null,
    @SerialName("url_preview") val urlPreview: String? = null,
    @SerialName("url_thumbnail") val urlThumbnail: String? = null,
    @SerialName("url_poster") val urlPoster: String? = null,
    @SerialName("es_premium") val esPremium: Boolean = false,
    @SerialName("destacado_orden") val destacadoOrden: Int? = null,
    @SerialName("fecha_publicacion") val fechaPublicacion: String? = null,
    val metricas: Metricas = Metricas(),
) {
    /** Lado mayor en px (1920 para "1080x1920"), o null si no consta. */
    val ladoMayor: Int? get() = resolucion?.split('x')?.mapNotNull { it.toIntOrNull() }?.maxOrNull()
}

/** Calidad de descarga que el cliente puede pedir a `wallpaper-url`. */
enum class CalidadDescarga(val codigo: String) { Q720("q720"), Q1080("q1080"), Q1440("q1440"), Q2160("q2160") }
