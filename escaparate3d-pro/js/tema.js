// ============================================================================
//  Escaparate 3D Pro — tema visual a partir de los colores del CONFIG
// ----------------------------------------------------------------------------
//  Un único sitio decide el color: config.colores. De ahí salen
//   - las CSS custom properties del HTML (--color-fondo, --color-acento, ...)
//   - los colores de los materiales de la escena 3D (tinte y luz de borde)
//  Nada de colores sueltos en el CSS ni en la escena.
// ============================================================================

export function aHex(color, respaldo = "#000000") {
  const t = String(color || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(t)) return "#" + t.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  return respaldo;
}

export function aRgb(color) {
  const h = aHex(color);
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

export function aNumero(color) {
  return parseInt(aHex(color).slice(1), 16);
}

export function mezclaColor(a, b, peso = 0.5) {
  const x = aRgb(a), y = aRgb(b), p = Math.min(1, Math.max(0, peso));
  const c = (u, v) => Math.round(u + (v - u) * p).toString(16).padStart(2, "0");
  return `#${c(x.r, y.r)}${c(x.g, y.g)}${c(x.b, y.b)}`;
}

// Luminancia relativa (WCAG) para decidir texto claro u oscuro sobre un color.
export function luminancia(color) {
  const { r, g, b } = aRgb(color);
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

// Contraste WCAG entre dos colores (1 = idénticos, 21 = negro sobre blanco).
export function contraste(a, b) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Elige el texto que MÁS contraste da sobre ese fondo, no un umbral a ojo:
// con un dorado #c9a227 gana el negro, con un azul #2f6bff gana el blanco.
export function textoSobre(color) {
  const oscuro = "#101418", claro = "#ffffff";
  return contraste(color, oscuro) >= contraste(color, claro) ? oscuro : claro;
}

// Paleta derivada: todo lo que necesitan el CSS y la escena 3D.
export function paleta(colores) {
  const fondo = aHex(colores?.fondo, "#0b0f14");
  const acento = aHex(colores?.acento, "#c9a227");
  const acento2 = aHex(colores?.acento2, "#2f6bff");
  const texto = aHex(colores?.texto, "#e8eef6");
  const claro = luminancia(fondo) > 0.5;
  return {
    fondo,
    acento,
    acento2,
    texto,
    // Superficies: el fondo aclarado (o oscurecido si el fondo ya es claro).
    superficie: mezclaColor(fondo, claro ? "#000000" : "#ffffff", 0.06),
    superficie2: mezclaColor(fondo, claro ? "#000000" : "#ffffff", 0.12),
    borde: mezclaColor(fondo, claro ? "#000000" : "#ffffff", 0.2),
    tenue: mezclaColor(texto, fondo, 0.35),
    sobreAcento: textoSobre(acento),
    sobreAcento2: textoSobre(acento2),
    fondoNiebla: mezclaColor(fondo, "#000000", claro ? 0 : 0.3),
    tarjeta3d: mezclaColor(fondo, claro ? "#000000" : "#ffffff", 0.1),
    esquemaClaro: claro,
  };
}

// Vuelca la paleta como custom properties: el CSS no conoce ningún color fijo.
export function aplicarTema(config, raiz = document.documentElement) {
  const p = paleta(config.colores);
  const props = {
    "--color-fondo": p.fondo,
    "--color-superficie": p.superficie,
    "--color-superficie-2": p.superficie2,
    "--color-borde": p.borde,
    "--color-acento": p.acento,
    "--color-acento-2": p.acento2,
    "--color-texto": p.texto,
    "--color-texto-tenue": p.tenue,
    "--color-sobre-acento": p.sobreAcento,
    "--color-sobre-acento-2": p.sobreAcento2,
  };
  for (const [clave, valor] of Object.entries(props)) raiz.style.setProperty(clave, valor);
  raiz.style.colorScheme = p.esquemaClaro ? "light" : "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", p.fondo);
  return p;
}
