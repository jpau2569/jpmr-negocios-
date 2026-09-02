/* ═══════════════════════════════════════════════════════════════════
   MOTOR — Índice Sol Niebla y Agua
   Convierte números en una puntuación 0-100, una etiqueta humana y una
   recomendación accionable. No sabe nada de DOM ni de red.
   ═══════════════════════════════════════════════════════════════════ */

import { limita, interpola, hh, hhmm } from './utiles.js';
import { CONFIG } from './datos.js';

/* ── Modos de uso: cada uno pondera el clima a su manera ──────────── */

export const MODOS = {
  paseo: {
    nombre:'Paseo',
    nota:'Confort general y ausencia de lluvia.',
    pesos:{ lluvia:1.35, nubes:.45, visibilidad:.40, viento:.75, humedad:.45, confort:1.05, luz:.55 }
  },
  fotos: {
    nombre:'Fotos',
    nota:'Luz, visibilidad y cielos con carácter.',
    pesos:{ lluvia:.85, nubes:.70, visibilidad:1.15, viento:.30, humedad:.20, confort:.30, luz:1.35 }
  },
  visitas: {
    nombre:'Visitas',
    nota:'Poca lluvia, comodidad y estabilidad.',
    pesos:{ lluvia:1.55, nubes:.35, visibilidad:.45, viento:.65, humedad:.40, confort:.95, luz:.50 }
  },
  carretera: {
    nombre:'Carretera',
    nota:'Visibilidad, niebla, viento y agua en la calzada.',
    pesos:{ lluvia:1.15, nubes:.15, visibilidad:1.70, viento:1.05, humedad:.15, confort:.15, luz:.65 }
  }
};

export const BANDAS = [
  { min:85, etiqueta:'Excelente',        tono:'sol'    },
  { min:70, etiqueta:'Muy aprovechable', tono:'sol'    },
  { min:50, etiqueta:'Aceptable',        tono:'niebla' },
  { min:30, etiqueta:'Día cerrado',      tono:'agua'   },
  { min:0,  etiqueta:'Muy mala ventana', tono:'agua'   }
];

/** Banda del índice (etiqueta + tono de color). */
export function banda(indice){ return BANDAS.find(b => indice >= b.min) || BANDAS.at(-1); }

/** Color CSS asociado a un índice. */
export function colorIndice(indice){
  const t = banda(indice).tono;
  return { sol:'var(--sol)', niebla:'var(--niebla)', agua:'var(--agua)' }[t];
}
/** Variante legible del color de banda, para cuando pinta texto. */
export function colorTexto(indice){
  const t = banda(indice).tono;
  return { sol:'var(--sol-txt)', niebla:'var(--niebla-txt)', agua:'var(--agua-txt)' }[t];
}

export function colorTenue(indice){
  const t = banda(indice).tono;
  return { sol:'var(--sol-tenue)', niebla:'var(--niebla-tenue)', agua:'var(--agua-tenue)' }[t];
}

/* ── Cálculo del índice ───────────────────────────────────────────── */
/* 0-100. Se parte de 100 y se restan penalizaciones ponderadas por modo.
   Después se aplican matices (hora dorada, cielos con carácter) y topes
   duros para situaciones que no admiten media: niebla densa, agua fuerte. */

export function calcularIndice(punto, modo, ciudad){
  const p = MODOS[modo].pesos;

  // Agua: la probabilidad avisa, la intensidad real es la que arruina el plan
  const penLluvia = limita(punto.probLluvia * .45 + limita(punto.precipitacion, 0, 4) / 4 * 55, 0, 100);

  // Nubes: en fotos un cielo totalmente limpio o totalmente plomizo pierde;
  // lo interesante está entre el 25 % y el 65 % de nubosidad.
  const penNubes = modo === 'fotos'
    ? (punto.nubosidad < 25 ? interpola(punto.nubosidad, 0, 25, 26, 4)
      : punto.nubosidad <= 65 ? 4
      : interpola(punto.nubosidad, 65, 100, 4, 62))
    : interpola(punto.nubosidad, 0, 100, 0, 38);

  // Visibilidad: la curva se dispara por debajo de 2 km (niebla asturiana)
  const v = punto.visibilidad;
  const penVisib = v >= 20000 ? 0
    : v >= 10000 ? interpola(v, 20000, 10000, 0, 7)
    : v >= 5000  ? interpola(v, 10000, 5000, 7, 20)
    : v >= 2000  ? interpola(v, 5000, 2000, 20, 44)
    : v >= 1000  ? interpola(v, 2000, 1000, 44, 66)
    : v >= 500   ? interpola(v, 1000, 500, 66, 82)
    : 94;

  const penViento  = limita((punto.viento - 12) * 1.9 + Math.max(0, punto.rachas - 35) * 1.1, 0, 100);
  const penHumedad = limita((punto.humedad - 82) * 1.7, 0, 26);

  // Confort térmico: óptimo entre 15 y 23 °C de sensación
  const s = punto.sensacion;
  const desvio = s < 15 ? 15 - s : s > 23 ? s - 23 : 0;
  const penConfort = limita(desvio * 3.4, 0, 55);

  // Luz: la noche no invalida conducir, pero sí pasear o fotografiar
  const penLuz = punto.esDeDia ? 0 : (modo === 'carretera' ? 22 : modo === 'visitas' ? 45 : 62);

  const pares = [
    [p.lluvia, penLluvia], [p.nubes, penNubes], [p.visibilidad, penVisib],
    [p.viento, penViento], [p.humedad, penHumedad], [p.confort, penConfort], [p.luz, penLuz]
  ];
  // Los factores se combinan de forma saturante, no promediando: dos cosas
  // malas se acumulan y una muy mala no queda diluida por las que van bien
  // (una media ponderada daría "excelente" a un día con 75 % de lluvia).
  const pesoMax = Math.max(...pares.map(([w]) => w));
  const bueno = pares.reduce((t, [w, x]) => t * (1 - limita(x, 0, 100) / 100 * (w / pesoMax)), 1);

  let indice = 100 * bueno;

  // Matices por modo
  if (modo === 'fotos'){
    const dorada = horaDorada(punto, ciudad);
    if (dorada && v > 8000 && punto.precipitacion === 0) indice += 9;
    if (punto.nubosidad >= 30 && punto.nubosidad <= 60 && v > 15000) indice += 4;
  }
  if (modo === 'carretera' && punto.viento < 14 && punto.precipitacion === 0 && v > 20000) indice += 3;
  if (modo === 'visitas' && punto.probLluvia < 15 && punto.viento < 16) indice += 4;

  // Topes duros: hay condiciones que ninguna media puede maquillar
  if (v < 600) indice = Math.min(indice, modo === 'carretera' ? 14 : 34);
  else if (v < 1500 && modo === 'carretera') indice = Math.min(indice, 32);
  if (punto.precipitacion >= 2) indice = Math.min(indice, 30);
  else if (punto.precipitacion >= .8) indice = Math.min(indice, 48);
  if (punto.rachas >= 60) indice = Math.min(indice, 38);

  return Math.round(limita(indice, 0, 100));
}

/** ¿Estamos en hora dorada? (±70 min de amanecer u ocaso) */
export function horaDorada(punto, ciudad){
  if (!ciudad?.hoy) return false;
  const t = punto.instante.getTime();
  const margen = 70 * 60e3;
  return Math.abs(t - ciudad.hoy.amanecer.getTime()) < margen
      || Math.abs(t - ciudad.hoy.ocaso.getTime()) < margen;
}

/** Enriquece cada ciudad con índice actual, serie horaria y ventana buena. */
/* `ahora` es el reloj, no el sello de los datos: si la app se abre con una
   caché de hace tres horas, la columna "Ahora" tiene que seguir siendo la
   hora actual y no la de entonces.                                       */
export function evaluar(datos, modo, ahora = new Date()){
  const desde = new Date(ahora.getTime() - 30 * 60e3);
  const ciudades = datos.ciudades.map(c => {
    const indice = calcularIndice(c.actual, modo, c);
    const futuras = c.horas
      .filter(h => h.instante >= desde)
      .slice(0, CONFIG.horasVista)
      .map(h => ({ ...h, indice: calcularIndice(h, modo, c) }));
    return { ...c, indice, futuras, ventana: buscarVentana(futuras, indice),
      bajon: buscarBajon(futuras, indice), etiquetas: [] };
  });

  ciudades.sort((a, b) => b.indice - a.indice);
  const mejor = ciudades[0];
  const costa    = ciudades.find(c => c.zona === 'costa');
  const interior = ciudades.filter(c => c.zona !== 'costa');
  const mediaInterior = interior.reduce((s, c) => s + c.indice, 0) / interior.length;

  ciudades.forEach(c => { c.etiquetas = etiquetasDe(c, mejor, costa, mediaInterior); });

  return { ...datos, ciudades, mejor, costa, interior, mediaInterior, modo };
}

/** Primer tramo de al menos 2 h seguidas con índice notablemente mejor. */
export function buscarVentana(futuras, indiceActual){
  if (futuras.length < 2) return null;
  const umbral = Math.max(66, indiceActual + 10);
  for (let i = 0; i < futuras.length - 1; i++){
    if (futuras[i].indice >= umbral && futuras[i + 1].indice >= umbral){
      let fin = i + 1;
      while (fin + 1 < futuras.length && futuras[fin + 1].indice >= umbral - 6) fin++;
      return { desde: futuras[i].instante, hasta: futuras[fin].instante, indice: futuras[i].indice, iDesde: i, iHasta: fin };
    }
  }
  return null;
}

/** Hora a la que las condiciones se estropean dentro de la vista. */
export function buscarBajon(futuras, indiceActual){
  if (futuras.length < 2) return null;
  const suelo = Math.min(indiceActual - 15, 62);
  const i = futuras.findIndex((h, j) => j > 0 && h.indice <= suelo);
  return i > 0 ? { desde: futuras[i].instante, indice: futuras[i].indice } : null;
}

/* ── Etiquetas, lectura del día y recomendación ───────────────────── */

export function etiquetasDe(c, mejor, costa, mediaInterior){
  const a = c.actual, et = [];
  const b = banda(c.indice);

  if (c.indice >= 85) et.push({ txt:'Excelente', tono:'sol' });
  else if (c.indice >= 70) et.push({ txt:'Muy aprovechable', tono:'sol' });

  if (a.visibilidad < 2000) et.push({ txt:'Ojo con niebla', tono:'niebla' });
  else if (c.futuras.some(h => h.visibilidad < 1500 && h.instante < new Date(Date.now() + 4 * 36e5)))
    et.push({ txt:'Niebla en camino', tono:'niebla' });

  if (a.nubosidad > 75 && a.probLluvia < 30 && a.precipitacion === 0)
    et.push({ txt:'Gris pero estable', tono:'niebla' });

  if (a.probLluvia >= 70 || a.precipitacion >= .5) et.push({ txt:'Agua segura', tono:'agua' });
  else if (a.probLluvia >= 45) et.push({ txt:'Agua probable', tono:'agua' });

  if (c.ventana && c.indice < 70) et.push({ txt:`Ventana buena ${hh(c.ventana.desde)}`, tono:'sol' });
  if (c.indice >= 70 && c.bajon) et.push({ txt:`Aprovecha hasta ${hh(c.bajon.desde)}`, tono:'sol' });
  if (a.rachas >= 50) et.push({ txt:'Viento fuerte', tono:'agua' });

  if (c.id === mejor.id){
    const esCosta = c.zona === 'costa';
    const margen = esCosta ? c.indice - mediaInterior : c.indice - (costa?.indice ?? 0);
    if (margen >= 6) et.push({ txt: esCosta ? 'Mejor ahora en costa' : 'Mejor ahora en interior', tono:'sol' });
  }

  if (!et.length) et.push({ txt: b.etiqueta, tono: b.tono });
  return et.slice(0, 4);
}

/** Frase de cabecera: qué está pasando hoy en Asturias, en una línea. */
export function lecturaDelDia(ev){
  const { mejor, ciudades, costa } = ev;
  const conNiebla = ciudades.filter(c => c.actual.visibilidad < 2000);
  const nieblaPronto = ciudades.filter(c => c.futuras.slice(0, 5).some(h => h.visibilidad < 1500));
  const lluviosas = ciudades.filter(c => c.actual.probLluvia >= 55 || c.actual.precipitacion > 0);
  const mediaLluvia = Math.round(ciudades.reduce((s, c) => s + c.actual.probLluvia, 0) / ciudades.length);
  const mediaNubes  = Math.round(ciudades.reduce((s, c) => s + c.actual.nubosidad, 0) / ciudades.length);

  if (conNiebla.length === ciudades.length)
    return `Niebla en las tres. Hoy manda la visibilidad y ${mejor.nombre} es la menos mala.`;
  if (conNiebla.length)
    return `Niebla ahora en ${lista(conNiebla.map(c => c.nombre))}. ${mejor.nombre} es hoy la apuesta clara.`;
  if (lluviosas.length === 3)
    return `Agua en toda Asturias central. ${mejor.nombre} aguanta algo mejor, pero es día de paraguas.`;
  if (lluviosas.length)
    return `Llueve en ${lista(lluviosas.map(c => c.nombre))} y se salva ${mejor.nombre}. ${costa && costa.indice > ev.mediaInterior ? 'La costa gana al interior.' : 'El interior gana a la costa.'}`;
  if (nieblaPronto.length)
    return `Cielos manejables ahora, con niebla asomando en ${lista(nieblaPronto.map(c => c.nombre))}. Aprovecha temprano.`;
  if (mediaNubes > 78 && mediaLluvia < 30)
    return `Cubierto pero estable en las tres. Día gris de andar por casa: se puede salir sin miedo.`;
  if (mejor.indice >= 82)
    return `Día grande en Asturias central. ${mejor.nombre} está para exprimirlo ahora mismo.`;
  if (mejor.indice >= 65)
    return `Buen rato en ${mejor.nombre}, con el resto un escalón por debajo. Ventana aprovechable.`;
  return `Día cerrado en las tres. Si hay que salir, ${mejor.nombre} es lo menos malo.`;
}

export function lista(nombres){
  if (nombres.length === 1) return nombres[0];
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres.at(-1);
}

/** Recomendación accionable: qué hacer, dónde y cuándo. */
export function recomendacion(ev){
  const { mejor, modo, ciudades, costa, mediaInterior } = ev;
  const a = mejor.actual;
  const nieblaAhora  = ciudades.filter(c => c.actual.visibilidad < 1500);
  const nieblaPronto = ciudades.filter(c => c.futuras.slice(0, 4).some(h => h.visibilidad < 1200));
  const segunda = ciudades[1];

  /* Carretera: la visibilidad manda por encima de todo lo demás */
  if (modo === 'carretera' && nieblaAhora.length)
    return { icono:'aviso', titulo:'Ojo con niebla para carretera',
      texto: nieblaAhora.length === ciudades.length
        ? 'Visibilidad bajo mínimos en las tres. Si puedes, no cojas el coche todavía.'
        : `Visibilidad bajo mínimos en ${lista(nieblaAhora.map(c => c.nombre))}. Si tienes que ir, antiniebla y sal con margen.` };

  if (modo === 'carretera' && nieblaPronto.length)
    return { icono:'aviso', titulo:'Sal antes de que cierre',
      texto:`Se espera niebla en ${lista(nieblaPronto.map(c => c.nombre))} en las próximas horas. Mejor hacer el trayecto ya.` };

  /* Momento bueno: dónde, hasta cuándo y por qué */
  if (mejor.indice >= 74)
    return { icono:'salir',
      titulo: { fotos:'Buena ventana para fotos', visitas:`Visitas mejor en ${mejor.nombre} ahora`,
                carretera:'Carretera despejada', paseo:'Sal ahora' }[modo],
      texto:`${mejor.nombre}, ${mejor.indice}/100.${cuando(mejor)}${geografia(ev, segunda) || retrato(a, modo)}` };

  /* Hay algo mejor más tarde */
  if (mejor.ventana)
    return { icono:'esperar',
      titulo: horasHasta(mejor.ventana.desde) <= 1 ? 'Espera una hora' : 'Espera una mejor apertura',
      texto:`Ahora ${mejor.nombre} ${mejor.indice < 40 ? 'está mal' : 'va justo'} (${mejor.indice}/100). `
        + `De ${hhmm(mejor.ventana.desde)} a ${hhmm(mejor.ventana.hasta)} sube a ${mejor.ventana.indice}/100.` };

  /* Agua: el consejo cambia según lo que vayas a hacer */
  if (a.probLluvia >= 55 || a.precipitacion > 0){
    const textos = {
      visitas:   `${a.probLluvia}% de lluvia en ${mejor.nombre}. Avisa al cliente, aparca cerca y deja los exteriores para el final.`,
      carretera: `${a.probLluvia}% de lluvia en ${mejor.nombre}. Calzada mojada: distancia de sobra y ojo a las salidas de túnel.`,
      fotos:     `${a.probLluvia}% de lluvia en ${mejor.nombre}. Protege el equipo o cambia a interiores; la luz no compensa el riesgo.`,
      paseo:     `${a.probLluvia}% de lluvia en ${mejor.nombre}. Sin ventana limpia en las próximas ${CONFIG.horasVista} horas.`
    };
    return { icono:'agua', titulo: modo === 'carretera' ? 'Conduce con margen' : 'Lleva paraguas', texto: textos[modo] };
  }

  /* Ni bueno ni malo: dónde está lo menos malo y qué es lo que falla */
  if (mejor.indice >= 50){
    const esCosta = mejor.zona === 'costa';
    return { icono:'esperar',
      titulo: `${esCosta ? 'Mejor costa' : 'Mejor interior'} en este momento${pero(a)}`,
      texto:`${mejor.nombre} es lo mejor que hay (${mejor.indice}/100):${estorbo(a, modo)}. Se puede, sin esperar maravillas.` };
  }

  if (modo === 'fotos' && a.esDeDia && mejor.hoy?.ocaso)
    return { icono:'esperar', titulo:'Mejor a última hora',
      texto:`Luz plana y poco interesante ahora. Prueba cerca del ocaso (${hhmm(mejor.hoy.ocaso)}) en ${mejor.nombre}.` };

  return { icono:'aviso', titulo:'Día para plan bajo techo',
    texto:`Ninguna de las tres pasa de ${Math.max(...ciudades.map(c => c.indice))}/100 en las próximas horas. Deja lo de fuera para mañana.` };
}

/** Hasta cuándo dura lo bueno. */
function cuando(mejor){
  if (mejor.bajon)  return ` Se estropea sobre las ${hhmm(mejor.bajon.desde)}: no lo dejes para luego.`;
  if (mejor.ventana) return ` Aguanta bien hasta las ${hhmm(mejor.ventana.hasta)}.`;
  return '';
}

/* La frase de costa contra interior sólo tiene sentido si la ciudad
   recomendada está del lado que gana; si no, decía "la costa gana"
   mientras recomendaba Oviedo. */
function geografia(ev, segunda){
  const { mejor, costa, mediaInterior } = ev;
  const esCosta = mejor.zona === 'costa';
  const ganaCosta = costa && costa.indice > mediaInterior;
  const margen = Math.abs(Math.round((costa?.indice ?? 0) - mediaInterior));
  if (ganaCosta === esCosta && margen >= 8)
    return esCosta ? ' La costa le gana al interior ahora mismo.' : ' El interior le gana a la costa ahora mismo.';
  if (segunda && mejor.indice - segunda.indice <= 4)
    return ` ${segunda.nombre} está casi igual: decide por cercanía.`;
  return '';
}

/** Tres cifras que sostienen la recomendación, para que nunca quede pelada. */
function retrato(a, modo){
  if (modo === 'carretera') return ` Visibilidad de ${Math.round(a.visibilidad / 1000)} km y viento flojo.`;
  if (modo === 'fotos')     return ` ${a.nubosidad}% de nubes y ${Math.round(a.visibilidad / 1000)} km de visibilidad.`;
  return ` ${a.probLluvia < 20 ? 'Lluvia descartada' : `${a.probLluvia}% de lluvia`}, ${Math.round(a.sensacion)}° y ${a.viento} km/h.`;
}

/** El "pero" del titular cuando el día es del montón. */
function pero(a){
  if (a.humedad >= 88) return ' pero húmedo';
  if (a.viento >= 30)  return ' pero con viento';
  if (a.nubosidad >= 80) return ' pero gris';
  return '';
}

/** Qué es exactamente lo que le falta al día, según el modo. */
function estorbo(a, modo){
  const partes = [];
  if (a.nubosidad >= 75) partes.push('cielo cerrado');
  if (a.probLluvia >= 30) partes.push(`${a.probLluvia}% de lluvia`);
  if (a.humedad >= 88) partes.push(`${a.humedad}% de humedad`);
  if (a.viento >= 30) partes.push(`${a.viento} km/h de viento`);
  if (a.visibilidad < 8000) partes.push(`${Math.round(a.visibilidad / 1000)} km de visibilidad`);
  if (!partes.length) partes.push(modo === 'fotos' ? 'luz plana' : 'nada del otro mundo');
  return ' ' + partes.slice(0, 2).join(' y ');
}

export function horasHasta(fecha){ return (fecha - Date.now()) / 36e5; }

export const ICONOS_CONSEJO = {
  salir:   '<path d="M5 12h13M13 6l6 6-6 6"/>',
  esperar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  agua:    '<path d="M12 3.5s6 6.5 6 10.4A6 6 0 0 1 6 13.9C6 10 12 3.5 12 3.5Z"/>',
  aviso:   '<path d="M12 4.5 21 19.5H3L12 4.5Z"/><path d="M12 10v4M12 17h.01"/>'
};

