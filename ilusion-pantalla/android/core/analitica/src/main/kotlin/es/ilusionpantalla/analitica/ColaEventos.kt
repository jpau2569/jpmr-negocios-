package es.ilusionpantalla.analitica

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import java.io.File

@Serializable
internal data class EventoGuardado(val evento: String, val propiedades: JsonObject, val tsMs: Long)

/** Cola persistente. Si no hay consentimiento vigente, [registrar] NO hace nada: no se escribe ni un byte. */
class ColaEventos(
    private val archivo: File,
    private val consentimiento: GestorConsentimiento,
    private val maximo: Int = 500,
    private val reloj: () -> Long = System::currentTimeMillis,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val items = ArrayDeque<EventoGuardado>()
    init { runCatching { items.addAll(json.decodeFromString<List<EventoGuardado>>(archivo.readText())) } }

    @Synchronized fun registrar(e: Evento): Boolean {
        if (!consentimiento.analiticaPermitida) return false
        items.addLast(EventoGuardado(e.nombre, JsonObject(e.propiedades.mapValues { (_, v) -> when (v) {
            is Boolean -> JsonPrimitive(v); is Int -> JsonPrimitive(v); is Long -> JsonPrimitive(v); else -> JsonPrimitive(v.toString()) } }), reloj()))
        while (items.size > maximo) items.removeFirst()          // si la red no vuelve, se pierde lo más viejo, no se llena el móvil
        persistir(); return true
    }

    @Synchronized fun tamano(): Int = items.size

    /** Próximo lote (sin sacarlo de la cola) con la antigüedad de cada evento calculada al enviar. */
    @Synchronized internal fun siguienteLote(n: Int): List<Pair<EventoGuardado, Int>> {
        val ahora = reloj()
        return items.take(n).map { it to ((ahora - it.tsMs) / 1000).coerceIn(0, 604_800).toInt() }
    }
    @Synchronized internal fun confirmar(cuantos: Int) { repeat(minOf(cuantos, items.size)) { items.removeFirst() }; persistir() }
    @Synchronized fun vaciar() { items.clear(); archivo.delete() }

    private fun persistir() {
        archivo.parentFile?.mkdirs()
        val tmp = File(archivo.path + ".tmp"); tmp.writeText(json.encodeToString<List<EventoGuardado>>(items.toList()))
        if (!tmp.renameTo(archivo)) { archivo.delete(); tmp.renameTo(archivo) }
    }
}
