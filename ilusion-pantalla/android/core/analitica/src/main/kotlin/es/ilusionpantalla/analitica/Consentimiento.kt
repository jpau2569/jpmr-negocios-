package es.ilusionpantalla.analitica

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

enum class EstadoConsentimiento {
    /** Nunca se ha preguntado: no se registra ni se envía nada. */
    SIN_PREGUNTAR,
    CONCEDIDO,
    /** Dijo que no (o revocó): no se registra ni se envía nada. */
    DENEGADO,
    /** Concedió una versión anterior del texto: se trata como NO hasta que vuelva a aceptar. */
    TEXTO_NUEVO,
}

@Serializable
internal data class Guardado(
    val concedido: Boolean? = null,
    val version: String? = null,
    /** Identificador ACTIVO. Solo existe mientras haya consentimiento (o TEXTO_NUEVO, que lo conserva). */
    val instalacionId: String? = null,
    val pendienteAlta: Boolean = false,              // falta avisar al servidor de la concesión
    /** Identificadores antiguos cuya revocación aún no consta en el servidor. */
    val revocar: List<String> = emptyList(),
    /** Identificadores antiguos cuyos datos hay que borrar en el servidor. */
    val borrar: List<String> = emptyList(),
)

/**
 * Fuente única del consentimiento de analítica. Reglas:
 *  - El identificador de instalación (UUID aleatorio, sin relación con el dispositivo ni la cuenta) NO existe
 *    hasta que el usuario acepta. Al revocar se retira del uso y solo se conserva para avisar/borrar en el servidor.
 *  - Tras revocar, aceptar de nuevo crea un identificador NUEVO: un borrado pendiente nunca puede tocar datos nuevos.
 *  - Cambiar la versión del texto invalida el consentimiento anterior.
 *  - Todo cambio se guarda en disco antes de devolver el control (sobrevive a cierres bruscos).
 */
class GestorConsentimiento(private val archivo: File, val versionActual: String, private val json: Json = Json { ignoreUnknownKeys = true }) {
    private var g: Guardado = leer()

    private fun leer(): Guardado = runCatching { json.decodeFromString<Guardado>(archivo.readText()) }.getOrDefault(Guardado())
    private fun guardar(n: Guardado) {
        g = n
        archivo.parentFile?.mkdirs()
        val tmp = File(archivo.path + ".tmp"); tmp.writeText(json.encodeToString(n))
        if (!tmp.renameTo(archivo)) { archivo.delete(); tmp.renameTo(archivo) }
    }

    val estado: EstadoConsentimiento
        get() = when {
            g.concedido == null -> EstadoConsentimiento.SIN_PREGUNTAR
            g.concedido == true && g.version == versionActual -> EstadoConsentimiento.CONCEDIDO
            g.concedido == true -> EstadoConsentimiento.TEXTO_NUEVO
            else -> EstadoConsentimiento.DENEGADO
        }
    val analiticaPermitida: Boolean get() = estado == EstadoConsentimiento.CONCEDIDO
    /** Hay que mostrar la pantalla de consentimiento. */
    val debePreguntar: Boolean get() = estado == EstadoConsentimiento.SIN_PREGUNTAR || estado == EstadoConsentimiento.TEXTO_NUEVO
    val instalacionId: String? get() = g.instalacionId.takeIf { analiticaPermitida }

    fun conceder() {
        if (analiticaPermitida) return
        guardar(g.copy(concedido = true, version = versionActual, instalacionId = g.instalacionId ?: UUID.randomUUID().toString(), pendienteAlta = true))
    }

    /** Denegar la primera vez no deja rastro ni avisa a nadie. Revocar tras haber concedido avisa al servidor. */
    fun denegar() {
        val id = g.instalacionId
        guardar(g.copy(concedido = false, version = versionActual, instalacionId = null, pendienteAlta = false, revocar = g.revocar + listOfNotNull(id)))
    }

    /** Revoca y pide borrar todo lo enviado con ese identificador (el propio borrado deja constancia de la revocación). */
    fun revocarYBorrar() {
        val id = g.instalacionId
        guardar(g.copy(concedido = false, version = versionActual, instalacionId = null, pendienteAlta = false, borrar = g.borrar + listOfNotNull(id)))
    }

    internal val pendienteAlta: Boolean get() = g.pendienteAlta && g.instalacionId != null
    internal val revocacionesPendientes: List<String> get() = g.revocar
    internal val borradosPendientes: List<String> get() = g.borrar
    internal fun altaEnviada() = guardar(g.copy(pendienteAlta = false))
    internal fun revocacionEnviada(id: String) = guardar(g.copy(revocar = g.revocar - id))
    internal fun borradoEnviado(id: String) = guardar(g.copy(borrar = g.borrar - id))
}
