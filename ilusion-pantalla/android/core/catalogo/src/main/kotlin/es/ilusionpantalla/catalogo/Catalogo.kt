package es.ilusionpantalla.catalogo

import java.text.Normalizer
import java.time.LocalDate

enum class Acceso { TODOS, GRATIS, PREMIUM }
enum class FamiliaColor(val etiqueta: String) {
    ROJO("Rojo"), NARANJA("Naranja"), AMARILLO("Amarillo"), VERDE("Verde"), TURQUESA("Turquesa"),
    AZUL("Azul"), VIOLETA("Violeta"), ROSA("Rosa"), NEUTRO("Neutro")
}

data class Filtros(
    val texto: String = "",
    val categorias: Set<String> = emptySet(),
    val acceso: Acceso = Acceso.TODOS,
    val orientacion: String? = null,
    val duracionMaxS: Double? = null,
    /** Lado mayor mínimo en px (p. ej. 2560 para "calidad alta"). */
    val ladoMinimo: Int? = null,
    val estilos: Set<String> = emptySet(),
    val colores: Set<FamiliaColor> = emptySet(),
)

fun sinTildes(s: String): String =
    Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase().trim()

/** Familia de color por matiz (HSV). Poca saturación o brillo ⇒ neutro. null si el hex no es válido. */
fun familiaDeColor(hex: String?): FamiliaColor? {
    if (hex == null || !Regex("^#[0-9A-Fa-f]{6}$").matches(hex)) return null
    val r = hex.substring(1, 3).toInt(16) / 255.0; val g = hex.substring(3, 5).toInt(16) / 255.0; val b = hex.substring(5, 7).toInt(16) / 255.0
    val max = maxOf(r, g, b); val min = minOf(r, g, b); val d = max - min
    if (max < 0.18 || (max > 0 && d / max < 0.18)) return FamiliaColor.NEUTRO
    val h = when (max) {
        r -> 60 * (((g - b) / d) % 6)
        g -> 60 * ((b - r) / d + 2)
        else -> 60 * ((r - g) / d + 4)
    }.let { if (it < 0) it + 360 else it }
    return when {
        h < 15 || h >= 345 -> FamiliaColor.ROJO
        h < 45 -> FamiliaColor.NARANJA
        h < 70 -> FamiliaColor.AMARILLO
        h < 165 -> FamiliaColor.VERDE
        h < 200 -> FamiliaColor.TURQUESA
        h < 255 -> FamiliaColor.AZUL
        h < 295 -> FamiliaColor.VIOLETA
        else -> FamiliaColor.ROSA
    }
}

class Catalogo(items: List<Wallpaper>) {
    val items: List<Wallpaper> = items.distinctBy { it.id }

    /** Búsqueda local (funciona sin conexión). Cada palabra debe aparecer en título, descripción, etiquetas o categoría. */
    fun buscar(f: Filtros): List<Wallpaper> {
        val palabras = sinTildes(f.texto).split(Regex("\\s+")).filter { it.isNotEmpty() }
        val estilos = f.estilos.map(::sinTildes).toSet()
        return items.filter { w ->
            (f.categorias.isEmpty() || w.categoriaSlug in f.categorias) &&
                when (f.acceso) { Acceso.TODOS -> true; Acceso.GRATIS -> !w.esPremium; Acceso.PREMIUM -> w.esPremium } &&
                (f.orientacion == null || w.orientacion == f.orientacion) &&
                (f.duracionMaxS == null || (w.duracionS != null && w.duracionS <= f.duracionMaxS)) &&
                (f.ladoMinimo == null || ((w.ladoMayor ?: 0) >= f.ladoMinimo)) &&
                (estilos.isEmpty() || (w.estilo != null && sinTildes(w.estilo) in estilos)) &&
                (f.colores.isEmpty() || familiaDeColor(w.colorDominante) in f.colores) &&
                palabras.all { p ->
                    val pajar = sinTildes(listOfNotNull(w.titulo, w.descripcion, w.categoriaNombre, w.etiquetas.joinToString(" ")).joinToString(" "))
                    p in pajar
                }
        }
    }

    // ── Secciones de Inicio ──
    /** El mismo para todo el mundo durante todo el día; rota entre los destacados. */
    fun fondoDelDia(hoy: LocalDate): Wallpaper? {
        val pool = items.filter { it.destacadoOrden != null }.sortedBy { it.destacadoOrden }.ifEmpty { items.sortedBy { it.slug } }
        if (pool.isEmpty()) return null
        return pool[Math.floorMod(hoy.toEpochDay(), pool.size.toLong()).toInt()]
    }
    fun populares(n: Int = 10): List<Wallpaper> =
        items.sortedWith(compareByDescending<Wallpaper> { it.metricas.descargas + 2 * it.metricas.aplicaciones + 3 * it.metricas.favoritos }.thenBy { it.slug }).take(n)
    fun nuevos(n: Int = 10): List<Wallpaper> =
        items.sortedWith(compareByDescending<Wallpaper> { it.fechaPublicacion ?: "" }.thenBy { it.slug }).take(n)
    fun seleccionPremium(n: Int = 10): List<Wallpaper> =
        items.filter { it.esPremium }.sortedWith(compareBy<Wallpaper> { it.destacadoOrden ?: Int.MAX_VALUE }.thenBy { it.slug }).take(n)
    fun arquitectura(): List<Wallpaper> =
        items.filter { it.categoriaSlug in setOf("arquitectura-e-interiores", "casas-de-lujo") }.sortedBy { it.slug }
    fun porCategoria(slug: String): List<Wallpaper> = items.filter { it.categoriaSlug == slug }

    /** Relacionados: misma categoría pesa más que etiquetas compartidas. Nunca incluye el propio. */
    fun relacionados(w: Wallpaper, n: Int = 6): List<Wallpaper> =
        items.filter { it.id != w.id }
            .map { o -> o to ((if (o.categoriaSlug != null && o.categoriaSlug == w.categoriaSlug) 3 else 0) + o.etiquetas.count { it in w.etiquetas } + (if (o.estilo != null && o.estilo == w.estilo) 1 else 0)) }
            .filter { it.second > 0 }
            .sortedWith(compareByDescending<Pair<Wallpaper, Int>> { it.second }.thenBy { it.first.slug })
            .take(n).map { it.first }
}
