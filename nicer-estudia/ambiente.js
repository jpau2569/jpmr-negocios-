/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — sonido de fondo del modo concentración
   Hay gente a la que el silencio le distrae más que el ruido. Aquí el
   sonido se GENERA con la Web Audio API en el propio móvil: ni un archivo
   que descargar, ni un servicio externo, y funciona sin conexión.

   Cada ambiente es ruido filtrado, que es de lo que están hechos la lluvia
   y el murmullo de una cafetería: ruido con las frecuencias agudas quitadas
   y el volumen respirando despacio.
   ═══════════════════════════════════════════════════════════════════ */

export const AMBIENTES = [
  { id: 'ninguno', nombre: 'Silencio', emoji: '🔇' },
  { id: 'lluvia', nombre: 'Lluvia', emoji: '🌧️' },
  { id: 'cafeteria', nombre: 'Cafetería', emoji: '☕' },
  { id: 'biblioteca', nombre: 'Biblioteca', emoji: '📚' },
  { id: 'mar', nombre: 'Mar', emoji: '🌊' }
];

/* Cada perfil dice cómo se filtra el ruido y cómo respira.
   `tipo` es el color del ruido, `corte` el filtro paso bajo, `respiro` la
   velocidad del vaivén del volumen y `golpes` los sonidos sueltos (tazas,
   una página) que hacen que no suene a máquina. */
export const PERFILES = {
  lluvia: { tipo: 'blanco', corte: 1500, suelo: 260, respiro: 0.14, vaiven: 0.14, ganancia: 0.5, golpes: null },
  cafeteria: { tipo: 'marron', corte: 900, suelo: 180, respiro: 0.09, vaiven: 0.2, ganancia: 0.62, golpes: { cada: [5, 14], agudo: 2400 } },
  biblioteca: { tipo: 'marron', corte: 420, suelo: 0, respiro: 0.05, vaiven: 0.1, ganancia: 0.34, golpes: { cada: [12, 30], agudo: 900 } },
  mar: { tipo: 'marron', corte: 800, suelo: 0, respiro: 0.055, vaiven: 0.55, ganancia: 0.6, golpes: null }
};

export const perfil = (id) => PERFILES[id] || null;

export const siguienteAmbiente = (id) => {
  const i = AMBIENTES.findIndex((a) => a.id === id);
  return AMBIENTES[(i + 1 + AMBIENTES.length) % AMBIENTES.length].id;
};

/** Cuatro segundos de ruido, generados una vez y repetidos en bucle. */
function bufferDeRuido(ctx, tipo) {
  const muestras = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  let anterior = 0;
  for (let i = 0; i < muestras; i++) {
    const blanco = Math.random() * 2 - 1;
    if (tipo === 'marron') {
      // Ruido marrón: se acumula el blanco, lo que sube los graves. El 3.5
      // devuelve el volumen que pierde al integrarse.
      anterior = (anterior + 0.02 * blanco) / 1.02;
      datos[i] = anterior * 3.5;
    } else {
      datos[i] = blanco;
    }
  }
  return buffer;
}

/**
 * Crea el reproductor. Devuelve un objeto con `reproducir`, `parar`,
 * `volumen` y `actual`. Si el navegador no tiene Web Audio, todo son
 * funciones vacías: la app no se entera y sigue funcionando.
 */
export function crearAmbiente(Contexto = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))) {
  let ctx = null;
  let nodos = null;
  let actual = 'ninguno';
  let nivel = 0.5;
  let temporizador = null;

  const parar = () => {
    clearTimeout(temporizador);
    temporizador = null;
    if (nodos) {
      try { nodos.fuente.stop(); } catch { /* ya estaba parada */ }
      try { nodos.lfo.stop(); } catch { /* ya estaba parado */ }
      try { nodos.salida.disconnect(); } catch { /* nada que desconectar */ }
      nodos = null;
    }
    actual = 'ninguno';
  };

  /* Un golpe suelto: una taza en la cafetería, una página en la biblioteca.
     Se programa solo el siguiente, con un hueco al azar, para que no caiga
     siempre en el mismo sitio y el oído no lo detecte como un bucle. */
  const programaGolpe = (config) => {
    const [min, max] = config.cada;
    const espera = (min + Math.random() * (max - min)) * 1000;
    temporizador = setTimeout(() => {
      if (!ctx || !nodos) return;
      try {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = config.agudo * (0.8 + Math.random() * 0.5);
        vol.gain.setValueAtTime(0.0001, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.05 * nivel, ctx.currentTime + 0.01);
        vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        osc.connect(vol).connect(nodos.salida);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch { /* si falla un golpe, el fondo sigue sonando */ }
      programaGolpe(config);
    }, espera);
  };

  return {
    actual: () => actual,

    volumen(v) {
      nivel = Math.min(1, Math.max(0, Number(v) || 0));
      if (nodos) nodos.salida.gain.value = nivel * nodos.ganancia;
    },

    reproducir(idAmbiente, v = nivel) {
      parar();
      nivel = Math.min(1, Math.max(0, Number(v) || 0));
      const p = perfil(idAmbiente);
      if (!p || !Contexto) return false;

      try {
        ctx = ctx || new Contexto();
        if (ctx.state === 'suspended') ctx.resume();

        const fuente = ctx.createBufferSource();
        fuente.buffer = bufferDeRuido(ctx, p.tipo);
        fuente.loop = true;

        const paso = ctx.createBiquadFilter();
        paso.type = 'lowpass';
        paso.frequency.value = p.corte;

        const salida = ctx.createGain();
        salida.gain.value = nivel * p.ganancia;

        // El vaivén: sin él suena a nevera; con él, a lluvia o a olas.
        const lfo = ctx.createOscillator();
        const profundidad = ctx.createGain();
        lfo.frequency.value = p.respiro;
        profundidad.gain.value = p.vaiven * p.ganancia * nivel;
        lfo.connect(profundidad).connect(salida.gain);

        let cadena = fuente.connect(paso);
        if (p.suelo) {
          const grave = ctx.createBiquadFilter();
          grave.type = 'highpass';
          grave.frequency.value = p.suelo;
          cadena = cadena.connect(grave);
        }
        cadena.connect(salida).connect(ctx.destination);

        fuente.start();
        lfo.start();
        nodos = { fuente, lfo, salida, ganancia: p.ganancia };
        actual = idAmbiente;
        if (p.golpes) programaGolpe(p.golpes);
        return true;
      } catch {
        nodos = null;
        actual = 'ninguno';
        return false;
      }
    },

    parar
  };
}
