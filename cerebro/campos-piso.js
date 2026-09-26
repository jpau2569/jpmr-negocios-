/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — los datos de un piso (ficha de captación)
   Una sola definición para todo: el formulario, la hoja de captación,
   el bloque de datos de la hoja de visita y lo que Clara puede rellenar
   a partir de un dictado o de un anuncio (api/_cerebro.js la importa).
   Tipos: texto · numero · opciones · sino (sí / no / sin indicar) · fecha (AAAA-MM-DD).
   Funciones puras.
   ═══════════════════════════════════════════════════════════════════ */

export const GRUPOS_PISO = [
  { id: 'inmueble', titulo: 'El inmueble' },
  { id: 'caracteristicas', titulo: 'Características' },
  { id: 'equipamiento', titulo: 'Equipamiento y extras' },
  { id: 'costes', titulo: 'Costes y situación' },
  { id: 'propietario', titulo: 'Propietario' },
  { id: 'encargo', titulo: 'Condiciones del encargo' },
];

export const CAMPOS_PISO = [
  // El inmueble
  { id: 'referencia', etiqueta: 'Referencia', tipo: 'texto', grupo: 'inmueble', max: 40 },
  { id: 'operacion', etiqueta: 'Operación', tipo: 'opciones', grupo: 'inmueble', opciones: ['Venta', 'Alquiler'] },
  { id: 'tipo', etiqueta: 'Tipo', tipo: 'opciones', grupo: 'inmueble', opciones: ['Piso', 'Ático', 'Dúplex', 'Bajo', 'Estudio', 'Apartamento', 'Casa', 'Chalet', 'Local', 'Oficina', 'Garaje', 'Trastero', 'Terreno', 'Otro'] },
  { id: 'direccion', etiqueta: 'Dirección', tipo: 'texto', grupo: 'inmueble', max: 120 },
  { id: 'planta', etiqueta: 'Planta y puerta', tipo: 'texto', grupo: 'inmueble', max: 30 },
  { id: 'municipio', etiqueta: 'Municipio', tipo: 'texto', grupo: 'inmueble', max: 60 },
  { id: 'zona', etiqueta: 'Zona / barrio', tipo: 'texto', grupo: 'inmueble', max: 60 },
  { id: 'codigoPostal', etiqueta: 'Código postal', tipo: 'texto', grupo: 'inmueble', max: 5 },
  { id: 'refCatastral', etiqueta: 'Referencia catastral', tipo: 'texto', grupo: 'inmueble', max: 25 },
  { id: 'precio', etiqueta: 'Precio', tipo: 'numero', grupo: 'inmueble', unidad: '€', min: 0 },
  // Características
  { id: 'm2Construidos', etiqueta: 'Superficie construida', tipo: 'numero', grupo: 'caracteristicas', unidad: 'm²', min: 0 },
  { id: 'm2Utiles', etiqueta: 'Superficie útil', tipo: 'numero', grupo: 'caracteristicas', unidad: 'm²', min: 0 },
  { id: 'habitaciones', etiqueta: 'Habitaciones', tipo: 'numero', grupo: 'caracteristicas', min: 0 },
  { id: 'banos', etiqueta: 'Baños', tipo: 'numero', grupo: 'caracteristicas', min: 0 },
  { id: 'ascensor', etiqueta: 'Ascensor', tipo: 'sino', grupo: 'caracteristicas' },
  { id: 'exterior', etiqueta: 'Exterior', tipo: 'sino', grupo: 'caracteristicas' },
  { id: 'orientacion', etiqueta: 'Orientación', tipo: 'texto', grupo: 'caracteristicas', max: 30 },
  { id: 'estado', etiqueta: 'Estado', tipo: 'opciones', grupo: 'caracteristicas', opciones: ['A estrenar', 'Reformado', 'Buen estado', 'A actualizar', 'A reformar'] },
  { id: 'anio', etiqueta: 'Año de construcción', tipo: 'numero', grupo: 'caracteristicas', min: 1700, maxNum: 2100, sinMiles: true },
  { id: 'calefaccion', etiqueta: 'Calefacción', tipo: 'texto', grupo: 'caracteristicas', max: 60 },
  { id: 'aguaCaliente', etiqueta: 'Agua caliente', tipo: 'texto', grupo: 'caracteristicas', max: 60 },
  { id: 'anioReforma', etiqueta: 'Año de la última reforma', tipo: 'numero', grupo: 'caracteristicas', min: 1700, maxNum: 2100, sinMiles: true },
  { id: 'm2Parcela', etiqueta: 'Superficie de parcela', tipo: 'numero', grupo: 'caracteristicas', unidad: 'm²', min: 0 },
  { id: 'accesibilidad', etiqueta: 'Accesibilidad', tipo: 'texto', grupo: 'caracteristicas', max: 120 },
  { id: 'cedulaHabitabilidad', etiqueta: 'Cédula de habitabilidad', tipo: 'opciones', grupo: 'caracteristicas', opciones: ['En vigor', 'No tiene', 'En trámite'] },
  { id: 'cee', etiqueta: 'Certificado energético', tipo: 'opciones', grupo: 'caracteristicas', opciones: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'En trámite', 'Exento'] },
  // Equipamiento y extras
  { id: 'garaje', etiqueta: 'Garaje', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'trastero', etiqueta: 'Trastero', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'terraza', etiqueta: 'Terraza / balcón', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'amueblado', etiqueta: 'Amueblado', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'cocinaEquipada', etiqueta: 'Cocina equipada', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'armarios', etiqueta: 'Armarios empotrados', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'piscina', etiqueta: 'Piscina', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'jardin', etiqueta: 'Jardín', tipo: 'sino', grupo: 'equipamiento' },
  { id: 'otrosExtras', etiqueta: 'Otros extras', tipo: 'texto', grupo: 'equipamiento', max: 200 },
  // Costes y situación
  { id: 'comunidad', etiqueta: 'Comunidad', tipo: 'numero', grupo: 'costes', unidad: '€/mes', min: 0 },
  { id: 'ibi', etiqueta: 'IBI', tipo: 'numero', grupo: 'costes', unidad: '€/año', min: 0 },
  { id: 'derrama', etiqueta: 'Derramas pendientes', tipo: 'texto', grupo: 'costes', max: 120 },
  { id: 'cargas', etiqueta: 'Cargas / hipoteca pendiente', tipo: 'texto', grupo: 'costes', max: 120 },
  { id: 'contratoAlquiler', etiqueta: 'Alquiler vigente (renta y vencimiento)', tipo: 'texto', grupo: 'costes', max: 120 },
  { id: 'proteccionOficial', etiqueta: 'Vivienda protegida (VPO)', tipo: 'sino', grupo: 'costes' },
  { id: 'ocupacion', etiqueta: 'Situación', tipo: 'opciones', grupo: 'costes', opciones: ['Libre', 'Alquilado', 'Ocupado por el propietario', 'Otra'] },
  { id: 'disponibilidad', etiqueta: 'Disponibilidad', tipo: 'texto', grupo: 'costes', max: 60 },
  // Propietario
  { id: 'propNombre', etiqueta: 'Nombre del propietario', tipo: 'texto', grupo: 'propietario', max: 80 },
  { id: 'propDni', etiqueta: 'DNI / NIE', tipo: 'texto', grupo: 'propietario', max: 20 },
  { id: 'propTelefono', etiqueta: 'Teléfono', tipo: 'texto', grupo: 'propietario', max: 20 },
  { id: 'propEmail', etiqueta: 'Correo', tipo: 'texto', grupo: 'propietario', max: 80 },
  { id: 'propDireccion', etiqueta: 'Dirección del propietario', tipo: 'texto', grupo: 'propietario', max: 120 },
  { id: 'titulares', etiqueta: 'Titulares y quién firma', tipo: 'texto', grupo: 'propietario', max: 200 },
  { id: 'propAceptaOfertas', etiqueta: 'Acepta información de otros servicios', tipo: 'sino', grupo: 'propietario' },
  // Condiciones del encargo
  { id: 'tipoEncargo', etiqueta: 'Tipo de encargo', tipo: 'opciones', grupo: 'encargo', opciones: ['Exclusiva', 'Sin exclusiva'] },
  { id: 'honorarios', etiqueta: 'Honorarios acordados', tipo: 'texto', grupo: 'encargo', max: 60 },
  { id: 'duracion', etiqueta: 'Duración del encargo', tipo: 'texto', grupo: 'encargo', max: 40 },
  { id: 'llaves', etiqueta: 'Llaves en la agencia', tipo: 'sino', grupo: 'encargo' },
  { id: 'autorizaPublicidad', etiqueta: 'Dónde se puede anunciar', tipo: 'opciones', grupo: 'encargo', opciones: ['Web y portales', 'Web, portales y cartel', 'Solo cartera privada'] },
  { id: 'lugarFirma', etiqueta: 'Lugar de firma del encargo', tipo: 'opciones', grupo: 'encargo', opciones: ['En la oficina', 'Fuera de la oficina'] },
  { id: 'comercializarYa', etiqueta: 'Pide empezar a comercializar ya (dentro de los 14 días)', tipo: 'sino', grupo: 'encargo' },
  // Interno: nunca sale en ningún PDF.
  { id: 'precioMinimo', etiqueta: 'Precio mínimo aceptado (interno)', tipo: 'numero', grupo: 'encargo', unidad: '€', min: 0, interno: true },
  { id: 'fechaCaptacion', etiqueta: 'Fecha de captación', tipo: 'fecha', grupo: 'encargo' },
];

/* Campos que describen el inmueble (sin datos del propietario ni del
   encargo): son los que salen en la hoja de visita. */
export const CAMPOS_INMUEBLE = CAMPOS_PISO.filter((c) => !['propietario', 'encargo'].includes(c.grupo));

const SI = /^(s[ií]|si|yes|true|1)$/i;
const NO = /^(no|false|0)$/i;

/** Normaliza un valor según su campo. Devuelve '' si no vale. */
export function valorCampo(campo, v) {
  if (v === null || v === undefined) return '';
  if (campo.tipo === 'numero') {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(n)) return '';
    if (campo.min !== undefined && n < campo.min) return '';
    if (campo.maxNum !== undefined && n > campo.maxNum) return '';
    return n;
  }
  if (campo.tipo === 'sino') {
    if (v === true) return 'Sí';
    if (v === false) return 'No';
    const s = String(v).trim();
    return SI.test(s) ? 'Sí' : NO.test(s) ? 'No' : '';
  }
  const s = String(v).trim();
  if (campo.tipo === 'fecha') {
    const es = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = es ? `${es[3]}-${es[2].padStart(2, '0')}-${es[1].padStart(2, '0')}` : s;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const d = new Date(`${iso}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : '';
  }
  if (campo.tipo === 'opciones') {
    const encontrada = campo.opciones.find((o) => o.toLowerCase() === s.toLowerCase());
    return encontrada || '';
  }
  return s.slice(0, campo.max || 200);
}

/** Deja en la ficha solo los campos conocidos y con valores válidos. */
export function limpiaFicha(datos) {
  const out = {};
  for (const c of CAMPOS_PISO) {
    const v = valorCampo(c, datos?.[c.id]);
    if (v !== '') out[c.id] = v;
  }
  return out;
}

/** Texto para mostrar un valor: 120000 → "120.000 €", 'Sí' → 'Sí'. */
export function textoCampo(campo, v) {
  if (v === '' || v === undefined || v === null) return '';
  if (campo.tipo === 'fecha') return String(v).split('-').reverse().join('/');
  if (campo.tipo === 'numero') {
    const n = Number(v);
    if (campo.sinMiles) return String(n);
    const s = n.toLocaleString('es-ES', { maximumFractionDigits: 2 }).replace(/(^|[^\d,])(\d{4})(?=[^\d]|$)/g, (_, p, d) => `${p}${d[0]}.${d.slice(1)}`);
    return campo.unidad ? `${s} ${campo.unidad}` : s;
  }
  return String(v);
}

/** Pares [etiqueta, texto] con valor, en el orden de la definición. */
export function paresFicha(ficha, campos = CAMPOS_PISO) {
  return campos.filter((c) => !c.interno && ficha?.[c.id] !== undefined && ficha[c.id] !== '').map((c) => [c.etiqueta, textoCampo(c, ficha[c.id])]);
}

/** Nombre corto para listas y selectores: "Ref. 123 · Uría 12, 3ºB · Oviedo". */
export function nombrePiso(ficha) {
  const partes = [ficha?.referencia && `Ref. ${ficha.referencia}`, [ficha?.direccion, ficha?.planta].filter(Boolean).join(', '), ficha?.municipio].filter(Boolean);
  return partes.join(' · ') || 'Piso sin datos';
}

/** Porcentaje de campos del inmueble rellenos (para animar a completar la ficha). */
export function completitud(ficha) {
  const llenos = CAMPOS_INMUEBLE.filter((c) => ficha?.[c.id] !== undefined && ficha[c.id] !== '').length;
  return Math.round((llenos / CAMPOS_INMUEBLE.length) * 100);
}

/** Esquema JSON (para la herramienta forzada de Claude en /api/cerebro). */
export function esquemaFicha() {
  const properties = {};
  for (const c of CAMPOS_PISO) {
    if (c.tipo === 'numero') properties[c.id] = { type: 'number', description: `${c.etiqueta}${c.unidad ? ` (${c.unidad})` : ''}` };
    else if (c.tipo === 'sino') properties[c.id] = { type: 'string', enum: ['Sí', 'No'], description: c.etiqueta };
    else if (c.tipo === 'opciones') properties[c.id] = { type: 'string', enum: c.opciones, description: c.etiqueta };
    else if (c.tipo === 'fecha') properties[c.id] = { type: 'string', description: `${c.etiqueta} (AAAA-MM-DD)` };
    else properties[c.id] = { type: 'string', description: c.etiqueta };
  }
  return { type: 'object', properties };
}

/* ── Referencia de zona ───────────────────────────────────────────────
   Precio medio de OFERTA en venta (€/m²) por municipio, tomado de la app
   EstateScore AI de Pau, que cita idealista (agosto de 2026). Solo los
   municipios con dato real, no los estimados. Es CONTEXTO: nunca sustituye
   a los comparables ni entra en el cálculo del rango. */
export const REFERENCIA_ZONA = {
  fuente: 'idealista, agosto 2026 (dato recogido en EstateScore AI)',
  municipios: { Oviedo: 2373, Gijón: 2696, Avilés: 1698, Siero: 1634, Mieres: 1036, Langreo: 1042 },
};

export function referenciaZona(municipio) {
  const clave = Object.keys(REFERENCIA_ZONA.municipios).find(
    (m) => m.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === String(municipio || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  );
  return clave ? { municipio: clave, eurosM2: REFERENCIA_ZONA.municipios[clave], fuente: REFERENCIA_ZONA.fuente } : null;
}
