package es.ilusionpantalla.catalogo

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL

class DescargaCancelada : IOException("descarga cancelada")
class DescargaIncompleta(mensaje: String) : IOException(mensaje)

/**
 * Descarga a `<nombre>.part` con reanudación por Range y renombrado atómico al terminar.
 * - Un archivo final solo existe si está COMPLETO y con el tamaño esperado (el servicio de wallpaper
 *   nunca ve un vídeo a medias).
 * - Si el servidor ignora Range (200 en vez de 206) se reinicia desde cero.
 * - Solo https (o localhost en pruebas): las URL firmadas viajan en la consulta.
 */
class Descargador(private val directorio: File, private val timeoutMs: Int = 20_000) {
    init { directorio.mkdirs() }

    fun archivo(nombre: String): File = File(directorio, seguro(nombre))

    fun descargar(url: String, nombre: String, bytesEsperados: Long?, cancelada: () -> Boolean = { false }, progreso: (Long, Long?) -> Unit = { _, _ -> }): File {
        require(url.startsWith("https://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) { "solo https" }
        val destino = archivo(nombre)
        if (destino.isFile && (bytesEsperados == null || destino.length() == bytesEsperados)) return destino
        val parcial = File(directorio, destino.name + ".part")
        var hecho = if (parcial.isFile) parcial.length() else 0L
        if (bytesEsperados != null && hecho > bytesEsperados) { parcial.delete(); hecho = 0 }

        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs
            if (hecho > 0) c.setRequestProperty("Range", "bytes=$hecho-")
            val codigo = c.responseCode
            if (codigo == 416) { parcial.delete(); return descargar(url, nombre, bytesEsperados, cancelada, progreso) }   // parcial inválido
            if (codigo != 200 && codigo != 206) throw DescargaIncompleta("HTTP $codigo")
            if (codigo == 200 && hecho > 0) { parcial.delete(); hecho = 0 }   // el servidor ignoró Range
            val total = bytesEsperados ?: c.contentLengthLong.takeIf { it > 0 }?.let { it + hecho }
            RandomAccessFile(parcial, "rw").use { f ->
                f.seek(hecho)
                c.inputStream.use { ins ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        if (cancelada()) throw DescargaCancelada()      // el .part se conserva para reanudar
                        val n = ins.read(buf); if (n < 0) break
                        f.write(buf, 0, n); hecho += n; progreso(hecho, total)
                    }
                }
            }
            if (total != null && parcial.length() != total) throw DescargaIncompleta("tamaño ${parcial.length()} ≠ $total")
            if (!parcial.renameTo(destino)) throw IOException("no se pudo finalizar el archivo")
            return destino
        } finally { c.disconnect() }
    }

    private fun seguro(n: String): String {
        require(n.matches(Regex("[A-Za-z0-9._-]{1,120}")) && !n.contains("..")) { "nombre de archivo inválido" }
        return n
    }
}

data class EntradaCache(val nombre: String, val bytes: Long, val ultimoUsoMs: Long)

object PoliticaCache {
    /**
     * Qué borrar para no pasar de [limiteBytes]: los menos usados primero.
     * Los [protegidos] (wallpaper activo y favoritos descargados) no se borran jamás, aunque el límite no se alcance.
     */
    fun aEliminar(entradas: List<EntradaCache>, limiteBytes: Long, protegidos: Set<String>): List<String> {
        require(limiteBytes >= 0)
        var total = entradas.sumOf { it.bytes }
        val borrar = mutableListOf<String>()
        for (e in entradas.filter { it.nombre !in protegidos }.sortedBy { it.ultimoUsoMs }) {
            if (total <= limiteBytes) break
            borrar += e.nombre; total -= e.bytes
        }
        return borrar
    }
}
