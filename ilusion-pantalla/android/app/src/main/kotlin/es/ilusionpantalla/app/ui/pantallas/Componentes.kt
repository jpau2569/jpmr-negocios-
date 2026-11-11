package es.ilusionpantalla.app.ui.pantallas

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import es.ilusionpantalla.catalogo.Wallpaper

private fun colorDe(hex: String?): Color = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color(0xFF141824))

/** Tarjeta 9:16. Sin miniatura todavía, muestra un degradado con el color dominante (nunca un hueco vacío). */
@Composable
fun TarjetaWallpaper(w: Wallpaper, alPulsar: () -> Unit, modifier: Modifier = Modifier) {
    val descripcion = "${w.titulo}${if (w.esPremium) ", Premium" else ", gratis"}"
    Box(
        modifier.aspectRatio(9f / 16f).clip(RoundedCornerShape(20.dp))
            .background(Brush.verticalGradient(listOf(colorDe(w.colorDominante), Color(0xFF0B0D12))))
            .clickable(onClick = alPulsar).semantics { contentDescription = descripcion },
    ) {
        if (w.urlThumbnail != null) AsyncImage(w.urlThumbnail, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC0B0D12)), startY = 250f)))
        if (w.esPremium) AssistChip(onClick = alPulsar, label = { Text("Premium") }, leadingIcon = { Icon(Icons.Filled.Star, null, Modifier.size(16.dp)) },
            modifier = Modifier.align(Alignment.TopStart).padding(8.dp))
        Text(w.titulo, Modifier.align(Alignment.BottomStart).padding(12.dp), style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun Carrusel(titulo: String, items: List<Wallpaper>, alPulsar: (Wallpaper) -> Unit) {
    if (items.isEmpty()) return
    Column(Modifier.padding(vertical = 8.dp)) {
        Text(titulo, Modifier.padding(horizontal = 16.dp, vertical = 8.dp), style = MaterialTheme.typography.titleMedium)
        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(items, key = { it.id }) { TarjetaWallpaper(it, { alPulsar(it) }, Modifier.width(140.dp)) }
        }
    }
}

@Composable
fun EstadoMensaje(titulo: String, texto: String, accion: String? = null, alAccion: () -> Unit = {}) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(titulo, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text(texto, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (accion != null) { Spacer(Modifier.height(16.dp)); Button(onClick = alAccion) { Text(accion) } }
    }
}

/** Esqueleto de carga (sin parpadeos de contenido). */
@Composable
fun EsqueletoInicio() {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        repeat(2) {
            Box(Modifier.fillMaxWidth().height(24.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surface))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(3) { Box(Modifier.width(110.dp).aspectRatio(9f / 16f).clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.surface)) }
            }
        }
    }
}

@Composable
fun AvisoCopia() = Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
    Text("Sin conexión: mostrando el catálogo guardado.", Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
