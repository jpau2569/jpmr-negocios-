/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — voz
   Dictar en vez de escribir y escuchar en vez de leer. Para un chaval de
   12 años, hablarle a Clara es mucho más natural que teclear, y oír una
   tarjeta de inglés con buen acento vale más que leerla diez veces.

   Todo va con lo que trae el propio navegador (Web Speech API): nada se
   descarga y no hace falta cuenta. Si el navegador no lo tiene, los
   botones simplemente no aparecen.
   ═══════════════════════════════════════════════════════════════════ */

const IDIOMAS = { es: 'es-ES', en: 'en-GB' };

const Reconocimiento = () =>
  (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export const puedeDictar = () => Boolean(Reconocimiento());
export const puedeLeer = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Quita lo que no se debe leer en voz alta: emojis, asteriscos, viñetas. */
export function limpiaParaLeer(texto) {
  return String(texto || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[*_#`>•·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Las voces tardan en cargar en Chrome: se piden cada vez, no una sola. */
function voz(idioma) {
  const codigo = IDIOMAS[idioma] || IDIOMAS.es;
  const voces = window.speechSynthesis.getVoices();
  return voces.find((v) => v.lang === codigo)
    || voces.find((v) => v.lang?.startsWith(codigo.slice(0, 2)))
    || null;
}

/* Para leer en voz alta una respuesta hay que saber en qué idioma está: en
   el modo de practicar inglés, Clara contesta en inglés. Basta con contar
   palabras muy frecuentes de cada idioma. Pura: se prueba en Node. */
const PALABRAS = {
  en: ['the', 'and', 'you', 'is', 'are', 'what', 'your', 'to', 'of', 'do', 'it', 'my', 'in', 'that', 'have', 'with', 'can', 'how'],
  es: ['el', 'la', 'de', 'que', 'y', 'es', 'en', 'los', 'las', 'un', 'una', 'por', 'para', 'con', 'tu', 'te', 'se', 'lo', 'como']
};
export function idiomaDe(texto) {
  const palabras = String(texto || '').toLowerCase().match(/[a-záéíóúñü]+/g) || [];
  const cuenta = (lista) => palabras.filter((p) => lista.includes(p)).length;
  return cuenta(PALABRAS.en) > cuenta(PALABRAS.es) ? 'en' : 'es';
}

export function lee(texto, idioma = 'es') {
  if (!puedeLeer()) return false;
  const limpio = limpiaParaLeer(texto);
  if (!limpio) return false;
  window.speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(limpio);
  frase.lang = IDIOMAS[idioma] || IDIOMAS.es;
  const elegida = voz(idioma);
  if (elegida) frase.voice = elegida;
  frase.rate = idioma === 'en' ? 0.92 : 1;
  window.speechSynthesis.speak(frase);
  return true;
}

export function calla() {
  if (puedeLeer()) window.speechSynthesis.cancel();
}

/**
 * Dicta una frase. `alTexto` recibe el texto parcial mientras habla (para
 * que vea que le está oyendo) y `alTerminar` el definitivo. Devuelve una
 * función para pararlo, o null si el navegador no sabe dictar.
 */
export function dicta({ idioma = 'es', alTexto = () => {}, alTerminar = () => {}, alError = () => {} } = {}) {
  const R = Reconocimiento();
  if (!R) return null;
  const rec = new R();
  rec.lang = IDIOMAS[idioma] || IDIOMAS.es;
  rec.interimResults = true;
  rec.continuous = false;
  let final = '';
  rec.onresult = (ev) => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const trozo = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) final += trozo;
      else parcial += trozo;
    }
    alTexto((final + parcial).trim());
  };
  rec.onerror = (ev) => {
    const motivo = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
      ? 'Hay que dar permiso al micrófono en el navegador.'
      : ev.error === 'no-speech' ? 'No te he oído. Prueba otra vez, más cerca del móvil.'
      : 'No se ha podido usar el micrófono.';
    alError(motivo);
  };
  rec.onend = () => alTerminar(final.trim());
  try { rec.start(); } catch { return null; }
  return () => { try { rec.stop(); } catch { /* ya parado */ } };
}
