package es.ilusionpantalla.app.ui.pantallas

import android.content.ActivityNotFoundException
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import es.ilusionpantalla.app.*
import es.ilusionpantalla.catalogo.*
import java.time.LocalDate

@Composable
private fun conCatalogo(vm: CatalogoViewModel, contenido: @Composable (Catalogo, Boolean) -> Unit) {
    when (val e = vm.estado.collectAsStateWithLifecycle().value) {
        EstadoCatalogo.Cargando -> EsqueletoInicio()
        is EstadoCatalogo.Error -> if (e.sinConfigurar)
            EstadoMensaje("Falta configurar el servidor", "Añade SUPABASE_URL y SUPABASE_ANON_KEY en local.properties y vuelve a compilar.")
        else EstadoMensaje("No hay conexión", "Conéctate a internet para ver el catálogo por primera vez.", "Reintentar") { vm.recargar() }
        is EstadoCatalogo.Listo -> contenido(e.catalogo, e.desdeCopia)
    }
}

@Composable
fun PantallaInicio(vm: CatalogoViewModel, abrir: (String) -> Unit) = conCatalogo(vm) { cat, copia ->
    LazyColumn(Modifier.fillMaxSize()) {
        if (copia) item { AvisoCopia() }
        cat.fondoDelDia(LocalDate.now())?.let { w ->
            item {
                Column(Modifier.padding(16.dp)) {
                    Text("Fondo del día", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    TarjetaWallpaper(w, { abrir(w.id) }, Modifier.fillMaxWidth(0.55f))
                }
            }
        }
        item { Carrusel("Populares", cat.populares()) { abrir(it.id) } }
        item { Carrusel("Nuevos lanzamientos", cat.nuevos()) { abrir(it.id) } }
        item { Carrusel("Selección Premium", cat.seleccionPremium()) { abrir(it.id) } }
        item { Carrusel("Arquitectura e interiores", cat.arquitectura()) { abrir(it.id) } }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PantallaExplorar(vm: CatalogoViewModel, abrir: (String) -> Unit) = conCatalogo(vm) { cat, copia ->
    val f by vm.filtros.collectAsStateWithLifecycle()
    val resultados = remember(f, cat) { cat.buscar(f) }
    val categorias = remember(cat) { cat.items.mapNotNull { it.categoriaSlug?.let { s -> s to (it.categoriaNombre ?: s) } }.distinct() }
    Column(Modifier.fillMaxSize()) {
        if (copia) AvisoCopia()
        OutlinedTextField(f.texto, { vm.filtrar(f.copy(texto = it)) }, Modifier.fillMaxWidth().padding(16.dp), singleLine = true,
            placeholder = { Text("Buscar fondos, estilos, lugares…") }, leadingIcon = { Icon(Icons.Filled.Search, null) })
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item { FilterChip(f.acceso == Acceso.GRATIS, { vm.filtrar(f.copy(acceso = if (f.acceso == Acceso.GRATIS) Acceso.TODOS else Acceso.GRATIS)) }, { Text("Gratis") }) }
            item { FilterChip(f.acceso == Acceso.PREMIUM, { vm.filtrar(f.copy(acceso = if (f.acceso == Acceso.PREMIUM) Acceso.TODOS else Acceso.PREMIUM)) }, { Text("Premium") }) }
            item { FilterChip(f.ladoMinimo == 2560, { vm.filtrar(f.copy(ladoMinimo = if (f.ladoMinimo == 2560) null else 2560)) }, { Text("Alta calidad") }) }
            item { FilterChip(f.duracionMaxS == 12.0, { vm.filtrar(f.copy(duracionMaxS = if (f.duracionMaxS == 12.0) null else 12.0)) }, { Text("Corto (≤12 s)") }) }
            items(categorias, key = { it.first }) { (slug, nombre) ->
                val on = slug in f.categorias
                FilterChip(on, { vm.filtrar(f.copy(categorias = if (on) f.categorias - slug else f.categorias + slug)) }, { Text(nombre) })
            }
        }
        if (resultados.isEmpty()) EstadoMensaje("Sin resultados", "Prueba con otras palabras o quita algún filtro.", "Quitar filtros") { vm.filtrar(Filtros()) }
        else LazyVerticalGrid(GridCells.Adaptive(120.dp), contentPadding = PaddingValues(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(resultados, key = { it.id }) { TarjetaWallpaper(it, { abrir(it.id) }) }
        }
    }
}

@Composable
fun PantallaFavoritos(vm: CatalogoViewModel, abrir: (String) -> Unit) = conCatalogo(vm) { cat, _ ->
    val favs by vm.favoritos.collectAsStateWithLifecycle()
    val lista = remember(favs, cat) { cat.items.filter { it.slug in favs } }
    if (lista.isEmpty()) EstadoMensaje("Aún no tienes favoritos", "Toca el corazón de un fondo para guardarlo aquí.")
    else LazyVerticalGrid(GridCells.Adaptive(120.dp), contentPadding = PaddingValues(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(lista, key = { it.id }) { TarjetaWallpaper(it, { abrir(it.id) }) }
    }
}

@Composable
fun PantallaDetalle(id: String, vm: CatalogoViewModel, atras: () -> Unit, abrir: (String) -> Unit, dvm: DetalleViewModel = viewModel()) = conCatalogo(vm) { cat, _ ->
    val w = cat.items.firstOrNull { it.id == id }
    if (w == null) { EstadoMensaje("Fondo no disponible", "Puede que se haya retirado del catálogo.", "Volver", atras); return@conCatalogo }
    val ctx = LocalContext.current
    val estado by dvm.estado.collectAsStateWithLifecycle()
    val favs by vm.favoritos.collectAsStateWithLifecycle()

    // Al terminar la descarga, abrir la confirmación NATIVA de Android (una sola vez por resultado).
    LaunchedEffect(estado) {
        if (estado == EstadoAplicar.ListoParaConfirmar) { lanzarConfirmacion(ctx); dvm.reiniciar() }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(atras) { Icon(Icons.Filled.ArrowBack, "Volver") }
                Spacer(Modifier.weight(1f))
                val esFav = w.slug in favs
                IconButton({ vm.alternarFavorito(w.slug) }) { Icon(if (esFav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, if (esFav) "Quitar de favoritos" else "Añadir a favoritos") }
            }
        }
        item { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { TarjetaWallpaper(w, {}, Modifier.fillMaxWidth(0.6f)) } }
        item { Text(w.titulo, style = MaterialTheme.typography.headlineSmall) }
        w.descripcion?.let { item { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
        item {
            val datos = listOfNotNull(
                w.categoriaNombre, w.resolucion?.replace("x", " × "), w.duracionS?.let { "${it.toInt()} s en bucle" },
                w.tamanoBytes?.let { "${it / 1_000_000} MB" }, w.consumoEstimado?.let { "Consumo $it" },
            )
            Text(datos.joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            when (val e = estado) {
                is EstadoAplicar.Descargando -> Column {
                    if (e.progreso != null) LinearProgressIndicator({ e.progreso }, Modifier.fillMaxWidth()) else LinearProgressIndicator(Modifier.fillMaxWidth())
                    TextButton(dvm::cancelar) { Text("Cancelar") }
                }
                else -> Button({ dvm.aplicar(w) }, Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Aplicar en mi pantalla") }
            }
            when (val e = estado) {
                EstadoAplicar.PremiumRequerido -> Text("Este fondo es Premium. La suscripción llegará muy pronto.", color = MaterialTheme.colorScheme.tertiary)
                is EstadoAplicar.Error -> Text(e.mensaje, color = MaterialTheme.colorScheme.error)
                else -> {}
            }
        }
        item { Carrusel("Relacionados", cat.relacionados(w)) { abrir(it.id) } }
    }
}

private fun lanzarConfirmacion(c: Context) {
    try { c.startActivity(AplicarWallpaper.intentConfirmacion(c)) }
    catch (e: ActivityNotFoundException) { runCatching { c.startActivity(AplicarWallpaper.intentSelector()) } }
}

@Composable
fun PantallaPerfil() {
    val ctx = LocalContext.current; val cfg = remember { ctx.contenedor.config }
    var a by remember { mutableStateOf(cfg.ajustes) }
    fun guardar(n: es.ilusionpantalla.rendimiento.Ajustes) { a = n; cfg.ajustes = n }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Ajustes", style = MaterialTheme.typography.headlineSmall) }
        item {
            Text("Calidad", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                es.ilusionpantalla.rendimiento.PerfilCalidad.entries.forEach { p ->
                    FilterChip(a.perfil == p, { guardar(a.copy(perfil = p)) }, { Text(p.name.lowercase().replaceFirstChar { it.uppercase() }) })
                }
            }
            Text("Se aplica al descargar un fondo nuevo.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            Text("Límite de fotogramas", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf<Int?>(null, 24, 30, 60).forEach { fps -> FilterChip(a.fpsLimite == fps, { guardar(a.copy(fpsLimite = fps)) }, { Text(fps?.let { "$it fps" } ?: "Auto") }) }
            }
        }
        item { Fila("Pausar con ahorro de energía", a.pausarEnAhorroSistema) { guardar(a.copy(pausarEnAhorroSistema = it)) } }
        item { Fila("Calidad adaptativa", a.calidadAdaptativa) { guardar(a.copy(calidadAdaptativa = it)) } }
        item { Fila("Descargar solo con Wi‑Fi", a.soloWifi) { guardar(a.copy(soloWifi = it)) } }
        item {
            Text("Pausar con batería baja: ${if (a.pausarBateriaBajaPct == 0) "nunca" else "${a.pausarBateriaBajaPct} %"}", style = MaterialTheme.typography.titleMedium)
            Slider(a.pausarBateriaBajaPct.toFloat(), { guardar(a.copy(pausarBateriaBajaPct = it.toInt())) }, valueRange = 0f..50f, steps = 9)
        }
        item { Text("Sin audio: los fondos nunca reproducen sonido.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun Fila(texto: String, valor: Boolean, cambio: (Boolean) -> Unit) =
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(texto, Modifier.weight(1f)); Switch(valor, cambio)
    }
