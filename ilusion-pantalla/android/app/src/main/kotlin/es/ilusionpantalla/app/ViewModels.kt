package es.ilusionpantalla.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import es.ilusionpantalla.analitica.*
import es.ilusionpantalla.catalogo.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

sealed interface EstadoCatalogo {
    data object Cargando : EstadoCatalogo
    data class Listo(val catalogo: Catalogo, val desdeCopia: Boolean) : EstadoCatalogo
    data class Error(val sinConfigurar: Boolean) : EstadoCatalogo
}

class CatalogoViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.contenedor
    private val _estado = MutableStateFlow<EstadoCatalogo>(EstadoCatalogo.Cargando)
    val estado: StateFlow<EstadoCatalogo> = _estado.asStateFlow()
    private val _filtros = MutableStateFlow(Filtros())
    val filtros: StateFlow<Filtros> = _filtros.asStateFlow()
    private val _favoritos = MutableStateFlow(c.favoritos.todos())
    val favoritos: StateFlow<Set<String>> = _favoritos.asStateFlow()

    init { recargar() }

    fun recargar() {
        _estado.value = EstadoCatalogo.Cargando
        viewModelScope.launch {
            if (!c.configurado) { _estado.value = EstadoCatalogo.Error(sinConfigurar = true); return@launch }
            _estado.value = when (val r = withContext(Dispatchers.IO) { c.repositorio.obtener() }) {
                is RepositorioCatalogo.Resultado.Fresco -> EstadoCatalogo.Listo(r.catalogo, false)
                is RepositorioCatalogo.Resultado.DesdeCopia -> EstadoCatalogo.Listo(r.catalogo, true)
                RepositorioCatalogo.Resultado.SinDatos -> EstadoCatalogo.Error(false)
            }
        }
    }
    fun filtrar(f: Filtros) { _filtros.value = f }
    fun alternarFavorito(slug: String) {
        val activo = c.favoritos.alternar(slug); _favoritos.value = c.favoritos.todos()
        c.evento(Evento.FavoritoAlternado(slug, activo))
    }
    fun registrarBusqueda(resultados: Int, conFiltros: Boolean) = c.evento(Evento.Busqueda(resultados, conFiltros))
    fun registrarVista(slug: String, origen: Origen) = c.evento(Evento.WallpaperVisto(slug, origen))
}

sealed interface EstadoAplicar {
    data object Reposo : EstadoAplicar
    data class Descargando(val progreso: Float?) : EstadoAplicar
    data object PremiumRequerido : EstadoAplicar
    data class Error(val mensaje: String) : EstadoAplicar
    /** Descargado y guardado como activo: la UI lanza la confirmación nativa de Android. */
    data object ListoParaConfirmar : EstadoAplicar
}

class DetalleViewModel(app: Application) : AndroidViewModel(app) {
    private val c = app.contenedor
    private val _estado = MutableStateFlow<EstadoAplicar>(EstadoAplicar.Reposo)
    val estado: StateFlow<EstadoAplicar> = _estado.asStateFlow()
    @Volatile private var cancelada = false

    fun aplicar(w: Wallpaper) {
        cancelada = false
        if (c.config.ajustes.soloWifi && c.redMedida()) {
            _estado.value = EstadoAplicar.Error("Estás sin Wi‑Fi. Conéctate a una red Wi‑Fi o desactiva «Descargar solo con Wi‑Fi» en Perfil.")
            return
        }
        _estado.value = EstadoAplicar.Descargando(null)
        viewModelScope.launch {
            val t0 = System.currentTimeMillis()
            val ajustes = c.config.ajustes
            val fps = minOf(ajustes.perfil.fpsMax, ajustes.fpsLimite ?: Int.MAX_VALUE)
            _estado.value = withContext(Dispatchers.IO) {
                try {
                    val pedida = Contenedor.calidadPara(ajustes.perfil)
                    val calidadEv = CalidadEv.entries.first { it.codigo == pedida.codigo }
                    c.evento(Evento.DescargaIniciada(w.slug, calidadEv))
                    when (val r = c.cliente.pedirUrl(w.id, pedida, c.hevcPorHardware, fps, tokenUsuario = null)) {
                        RespuestaUrl.PremiumRequerido, RespuestaUrl.SesionNoValida -> { c.evento(Evento.DescargaFallida(w.slug, MotivoDescarga.PREMIUM)); EstadoAplicar.PremiumRequerido }
                        RespuestaUrl.NoEncontrado -> { c.evento(Evento.DescargaFallida(w.slug, MotivoDescarga.OTRO)); EstadoAplicar.Error("Este fondo ya no está disponible.") }
                        is RespuestaUrl.Fallo -> { c.evento(Evento.DescargaFallida(w.slug, MotivoDescarga.RED)); EstadoAplicar.Error("No se pudo preparar la descarga (${r.mensaje}). Inténtalo de nuevo.") }
                        is RespuestaUrl.Lista -> {
                            val archivo = c.descargador.descargar(r.url, "${w.slug}_${r.calidad}.mp4", r.tamanoBytes, cancelada = { cancelada },
                                progreso = { h, t -> if (t != null) _estado.value = EstadoAplicar.Descargando(h.toFloat() / t) })
                            c.config.archivo = archivo
                            c.limpiarCache(1_024L * 1024 * 1024)
                            val real = CalidadEv.entries.firstOrNull { it.codigo == r.calidad } ?: calidadEv
                            c.evento(Evento.DescargaCompletada(w.slug, real, System.currentTimeMillis() - t0))
                            c.evento(Evento.WallpaperAplicado(w.slug))          // se abre la confirmación; «activado» se confirma al volver
                            EstadoAplicar.ListoParaConfirmar
                        }
                    }
                } catch (e: DescargaCancelada) { c.evento(Evento.DescargaFallida(w.slug, MotivoDescarga.CANCELADA)); EstadoAplicar.Reposo }
                catch (e: IOException) { c.evento(Evento.DescargaFallida(w.slug, MotivoDescarga.RED)); EstadoAplicar.Error("Se cortó la descarga. Al reintentar continuará donde se quedó.") }
            }
        }
    }
    fun cancelar() { cancelada = true }
    fun reiniciar() { _estado.value = EstadoAplicar.Reposo }
}
