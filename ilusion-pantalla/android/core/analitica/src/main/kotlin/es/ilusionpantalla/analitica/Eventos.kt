package es.ilusionpantalla.analitica

/**
 * Catálogo CERRADO de eventos. Espejo de supabase/functions/_shared/eventos.json (fuente de verdad);
 * un test falla si se desincronizan. Ninguna propiedad admite texto libre: solo enums, números,
 * booleanos y slugs del catálogo. Jamás búsquedas, nombres, emails ni identificadores de publicidad.
 */
enum class Origen(val codigo: String) { INICIO("inicio"), EXPLORAR("explorar"), FAVORITOS("favoritos"), RELACIONADOS("relacionados") }
enum class CalidadEv(val codigo: String) { Q720("q720"), Q1080("q1080"), Q1440("q1440"), Q2160("q2160") }
enum class PerfilEv(val codigo: String) { AHORRO("ahorro"), ESTANDAR("estandar"), ALTA("alta"), ULTRA("ultra") }
enum class MotivoDescarga(val codigo: String) { RED("red"), PREMIUM("premium"), CANCELADA("cancelada"), OTRO("otro") }
enum class AjusteEv(val codigo: String) { PERFIL("perfil"), FPS("fps"), ADAPTATIVA("adaptativa"), BATERIA("bateria"), AHORRO("ahorro"), WIFI("wifi") }

enum class PlanEv(val codigo: String) { MENSUAL("mensual"), ANUAL("anual") }
enum class MotivoPaywall(val codigo: String) { WALLPAPER_PREMIUM("wallpaper_premium"), PERFIL("perfil") }

private val SLUG = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
private val VERSION = Regex("^[0-9A-Za-z.+_-]{1,20}$")
private fun slug(s: String) = s.also { require(it.length <= 60 && SLUG.matches(it)) { "slug inválido" } }

sealed class Evento(val nombre: String, val propiedades: Map<String, Any>) {
    class AppAbierta(versionApp: String, androidSdk: Int, primeraVez: Boolean) : Evento("app_abierta", mapOf(
        "version_app" to versionApp.also { require(VERSION.matches(it)) { "versión inválida" } },
        "android_sdk" to androidSdk.also { require(it in 21..99) }, "primera_vez" to primeraVez))
    class WallpaperVisto(s: String, origen: Origen) : Evento("wallpaper_visto", mapOf("wallpaper_slug" to slug(s), "origen" to origen.codigo))
    /** Solo CUÁNTOS resultados y si había filtros. El texto buscado no sale nunca del móvil. */
    class Busqueda(resultados: Int, conFiltros: Boolean) : Evento("busqueda", mapOf("resultados" to resultados.coerceIn(0, 100_000), "con_filtros" to conFiltros))
    class FavoritoAlternado(s: String, activo: Boolean) : Evento("favorito_alternado", mapOf("wallpaper_slug" to slug(s), "activo" to activo))
    class DescargaIniciada(s: String, calidad: CalidadEv) : Evento("descarga_iniciada", mapOf("wallpaper_slug" to slug(s), "calidad" to calidad.codigo))
    class DescargaCompletada(s: String, calidad: CalidadEv, duracionMs: Long) : Evento("descarga_completada", mapOf(
        "wallpaper_slug" to slug(s), "calidad" to calidad.codigo, "duracion_ms" to duracionMs.coerceIn(0, 3_600_000).toInt()))
    class DescargaFallida(s: String, motivo: MotivoDescarga) : Evento("descarga_fallida", mapOf("wallpaper_slug" to slug(s), "motivo" to motivo.codigo))
    class WallpaperAplicado(s: String) : Evento("wallpaper_aplicado", mapOf("wallpaper_slug" to slug(s)))
    class WallpaperActivado(s: String, perfil: PerfilEv) : Evento("wallpaper_activado", mapOf("wallpaper_slug" to slug(s), "perfil" to perfil.codigo))
    class AjusteCambiado(ajuste: AjusteEv) : Evento("ajuste_cambiado", mapOf("ajuste" to ajuste.codigo))
    class PaywallVisto(motivo: MotivoPaywall) : Evento("paywall_visto", mapOf("motivo" to motivo.codigo))
    class CompraIniciada(plan: PlanEv) : Evento("compra_iniciada", mapOf("plan" to plan.codigo))
    /** Solo cuando el servidor ha verificado la compra (no cuando Play dice «ok» en el móvil). */
    class CompraCompletada(plan: PlanEv) : Evento("compra_completada", mapOf("plan" to plan.codigo))
}
