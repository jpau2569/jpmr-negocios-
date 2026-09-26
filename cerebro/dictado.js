/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — dictado por voz
   Usa el reconocimiento de voz del navegador (Chrome en Android y en el
   PC). Va añadiendo lo dictado al cuadro de texto; Pau puede dictar en
   varias tandas. Si el navegador no lo admite, el botón se oculta y
   queda el micrófono del teclado del móvil, que hace lo mismo.
   ═══════════════════════════════════════════════════════════════════ */

const Reconocimiento = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export const dictadoDisponible = () => Boolean(Reconocimiento);

/**
 * Conecta un botón a un <textarea>. Devuelve { para() }.
 * alCambiarEstado(escuchando: boolean, mensaje?: string)
 */
export function conectaDictado(boton, area, { alCambiarEstado } = {}) {
  if (!Reconocimiento) {
    boton.hidden = true;
    return { para() {} };
  }
  let rec = null;
  let base = '';
  let escuchando = false;

  const estado = (on, msg) => {
    escuchando = on;
    boton.setAttribute('aria-pressed', on ? 'true' : 'false');
    boton.textContent = on ? '⏹ Parar dictado' : '🎙 Dictar';
    alCambiarEstado?.(on, msg);
  };

  const empieza = () => {
    rec = new Reconocimiento();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    base = area.value ? area.value.replace(/\s*$/, ' ') : '';
    rec.onresult = (ev) => {
      let fijo = '';
      let provisional = '';
      for (let i = 0; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fijo += t + ' ';
        else provisional += t;
      }
      area.value = (base + fijo + provisional).replace(/\s{2,}/g, ' ');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = (ev) => {
      const mensajes = {
        'not-allowed': 'El navegador no tiene permiso para usar el micrófono.',
        'no-speech': 'No te he oído. Prueba otra vez, más cerca del móvil.',
        network: 'El dictado necesita conexión a internet.',
      };
      estado(false, mensajes[ev.error] || 'El dictado se ha cortado.');
    };
    rec.onend = () => { if (escuchando) estado(false); };
    try {
      rec.start();
      estado(true, 'Te escucho… dicta los datos del piso.');
    } catch {
      estado(false, 'No se pudo empezar el dictado.');
    }
  };

  boton.addEventListener('click', () => {
    if (escuchando) { rec?.stop(); estado(false); } else empieza();
  });
  estado(false);
  return { para() { if (escuchando) rec?.stop(); } };
}
