/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — contactos de la agenda del móvil
   WhatsApp no deja que ninguna app lea sus contactos: los contactos de
   WhatsApp SON los de la agenda del teléfono. Hay dos caminos reales:
   1. Selector de contactos del navegador (Chrome en Android, con HTTPS):
      Pau elige en su móvil cuáles compartir (puede marcar todos). La app
      solo recibe nombre, teléfonos y correos de los que marque.
   2. Archivo .vcf: Contactos de Android → Exportar, o en iPhone la app
      Contactos → lista → Exportar. Se lee aquí, sin subirlo a ningún sitio.
   En los dos casos se enseña una vista previa con duplicados antes de
   guardar, y entran como «Solo contacto» para no llenar el CRM.
   ═══════════════════════════════════════════════════════════════════ */

const MAX_CONTACTOS = 5000;

/* ───────────── vCard 2.1, 3.0 y 4.0 ───────────── */

// Quoted-printable (vCard 2.1 de Android: «ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8»).
function decodificaQP(v) {
  const s = String(v).replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) { bytes.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(...new TextEncoder().encode(s[i]));
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}
const desescapa = (v) => String(v).replace(/\\n/gi, '\n').replace(/\\([,;:\\])/g, '$1');
const limpia = (v) => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
const telefono = (v) => String(v || '').replace(/^tel:/i, '').replace(/[^\d+ ()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);

/**
 * @returns {{contactos: {nombre:string, apellidos:string, telefonos:string[], emails:string[], nota:string}[], recortado:boolean}}
 */
export function leeVcard(texto) {
  const bruto = String(texto || '').replace(/\r\n/g, '\n');
  // Líneas plegadas (empiezan por espacio) y quoted-printable que acaba en «=».
  const lineas = [];
  for (const l of bruto.split('\n')) {
    const previa = lineas.length ? lineas[lineas.length - 1] : null;
    if (previa !== null && /^[ \t]/.test(l)) lineas[lineas.length - 1] = previa + l.slice(1);
    else if (previa !== null && /QUOTED-PRINTABLE/i.test(previa.split(':')[0]) && previa.endsWith('=')) lineas[lineas.length - 1] = previa.slice(0, -1) + l;
    else lineas.push(l);
  }
  const contactos = [];
  let actual = null;
  let recortado = false;
  for (const l of lineas) {
    if (/^BEGIN:VCARD/i.test(l)) { actual = { nombre: '', apellidos: '', completo: '', telefonos: [], emails: [], nota: '' }; continue; }
    if (/^END:VCARD/i.test(l)) {
      if (actual && (actual.nombre || actual.completo || actual.telefonos.length)) {
        if (contactos.length >= MAX_CONTACTOS) { recortado = true; break; }
        if (!actual.nombre && actual.completo) {
          const [n, ...resto] = actual.completo.split(' ');
          actual.nombre = n; actual.apellidos = resto.join(' ');
        }
        delete actual.completo;
        contactos.push(actual);
      }
      actual = null;
      continue;
    }
    if (!actual) continue;
    const dos = l.indexOf(':');
    if (dos < 0) continue;
    const [propiedad, ...params] = l.slice(0, dos).split(';');
    const prop = propiedad.replace(/^item\d+\./i, '').toUpperCase();
    let valor = l.slice(dos + 1);
    if (params.some((p) => /QUOTED-PRINTABLE/i.test(p))) valor = decodificaQP(valor);
    if (prop === 'N') {
      // N:Apellidos;Nombre;Segundo nombre;Prefijo;Sufijo
      const [ap, nom, otro] = valor.split(';').map((x) => limpia(desescapa(x)));
      if (nom || ap) { actual.nombre = [nom, otro].filter(Boolean).join(' ').slice(0, 80) || ap.slice(0, 80); actual.apellidos = nom ? ap.slice(0, 120) : ''; }
      continue;
    }
    valor = desescapa(valor).trim();
    if (!valor) continue;
    if (prop === 'FN') actual.completo = limpia(valor).slice(0, 200);
    else if (prop === 'TEL') { const t = telefono(valor); if (t && !actual.telefonos.includes(t)) actual.telefonos.push(t); }
    else if (prop === 'EMAIL') actual.emails.push(limpia(valor).slice(0, 120));
    else if (prop === 'NOTE') actual.nota = (actual.nota ? actual.nota + '\n' : '') + valor.slice(0, 1000);
  }
  return { contactos, recortado };
}

/** Un móvil español (6xx/7xx) va primero: es el que suele tener WhatsApp. */
function ordenaTelefonos(lista) {
  const movil = (t) => /^(\+?34)?[67]\d{8}$/.test(t.replace(/[\s()-]/g, ''));
  return [...lista].sort((a, b) => Number(movil(b)) - Number(movil(a)));
}

/** Contacto (del .vcf o del selector) → datos de cliente sin validar. */
export function clienteDeContacto(c, procedencia) {
  const tels = ordenaTelefonos(c.telefonos || []);
  const extra = [tels.length > 1 && `Otros teléfonos: ${tels.slice(1).join(', ')}`, (c.emails || []).length > 1 && `Otros correos: ${c.emails.slice(1).join(', ')}`, c.nota].filter(Boolean).join('\n');
  return {
    nombre: c.nombre || (tels[0] ? 'Sin nombre' : ''),
    apellidos: c.apellidos || '',
    telefono: tels[0] || '',
    email: (c.emails || [])[0] || '',
    tipo: 'otro',
    estado: 'contacto',
    procedencia,
    etiquetas: ['agenda-movil'],
    notas: extra,
  };
}

/* ───────────── selector de contactos del navegador ───────────── */

export const selectorContactosDisponible = () => typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function';

/** Abre el selector del móvil. Solo devuelve lo que Pau marque. */
export async function eligeContactosDelMovil() {
  const disponibles = await navigator.contacts.getProperties?.().catch(() => null) || ['name', 'tel', 'email'];
  const pedir = ['name', 'tel', 'email'].filter((p) => disponibles.includes(p));
  const elegidos = await navigator.contacts.select(pedir, { multiple: true });
  return (elegidos || []).map((x) => {
    const completo = limpia((x.name || [])[0] || '');
    const [nombre, ...resto] = completo.split(' ');
    return { nombre: nombre || '', apellidos: resto.join(' '), telefonos: (x.tel || []).map(telefono).filter(Boolean), emails: (x.email || []).map(limpia).filter(Boolean), nota: '' };
  }).filter((c) => c.nombre || c.telefonos.length);
}
