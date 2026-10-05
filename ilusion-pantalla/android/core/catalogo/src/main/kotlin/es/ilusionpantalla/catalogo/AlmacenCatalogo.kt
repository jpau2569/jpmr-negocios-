package es.ilusionpantalla.catalogo

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

@Serializable private data class Instantanea(val version: Int, val guardadoMs: Long, val items: List<Wallpaper>)

/** Copia local del catálogo para el modo sin conexión. Escritura atómica; un archivo corrupto se ignora. */
class AlmacenCatalogo(private val archivo: File, private val json: Json = Json { ignoreUnknownKeys = true; coerceInputValues = true }) {
    fun guardar(items: List<Wallpaper>, ahoraMs: Long = System.currentTimeMillis()) {
        archivo.parentFile?.mkdirs()
        val tmp = File(archivo.path + ".tmp")
        tmp.writeText(json.encodeToString(Instantanea(1, ahoraMs, items)))
        if (!tmp.renameTo(archivo)) { archivo.delete(); tmp.renameTo(archivo) }
    }
    fun cargar(): Pair<List<Wallpaper>, Long>? = runCatching {
        val i = json.decodeFromString<Instantanea>(archivo.readText()); i.items to i.guardadoMs
    }.getOrNull()
}

/** Catálogo con red primero y copia local como respaldo. */
class RepositorioCatalogo(private val cliente: ClienteSupabase, private val almacen: AlmacenCatalogo) {
    sealed interface Resultado {
        data class Fresco(val catalogo: Catalogo) : Resultado
        data class DesdeCopia(val catalogo: Catalogo, val guardadoMs: Long) : Resultado
        data object SinDatos : Resultado
    }
    fun obtener(): Resultado = try {
        val items = cliente.descargarCatalogo(); almacen.guardar(items); Resultado.Fresco(Catalogo(items))
    } catch (e: ErrorRed) {
        almacen.cargar()?.let { (items, t) -> Resultado.DesdeCopia(Catalogo(items), t) } ?: Resultado.SinDatos
    }
}
