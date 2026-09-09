// ============================================================================
//  Escaparate 3D Pro — capa de datos intercambiable
// ----------------------------------------------------------------------------
//  Las tres funciones que el producto necesita para vender de verdad:
//     guardarPedido()  guardarReserva()  guardarLead()
//  Tienen tres implementaciones que se eligen con config.datos.modo:
//     "local"    → navegador (demo sin backend; nada se pierde)
//     "api"      → POST a los endpoints del propio despliegue (/api/lead, ...)
//     "firebase" → Firestore por REST, sin SDK ni empaquetador
//  Pase lo que pase, SIEMPRE queda copia local: si el envío falla, el negocio
//  no se queda sin el pedido y la página ofrece mandarlo por WhatsApp.
// ============================================================================

import { urlFirestore } from "./config.js";

const CLAVE = "escaparate3d-pro:registros";
const MAX_GUARDADOS = 200;

export function referencia(prefijo) {
  const d = new Date();
  const dia = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefijo}-${dia}-${azar}`;
}

function leerTodo() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function guardarLocal(registro) {
  try {
    const lista = leerTodo();
    lista.unshift(registro);
    localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAX_GUARDADOS)));
    return true;
  } catch {
    return false; // navegación privada o almacenamiento bloqueado: no es un error fatal
  }
}

async function enviarJson(url, cuerpo) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos?.error || `HTTP ${r.status}`);
  return datos;
}

/* --- Firestore por REST ---------------------------------------------------- */
// Convierte un objeto JS al formato de campos tipados que espera Firestore.
export function aFirestore(valor) {
  if (valor === null || valor === undefined) return { nullValue: null };
  if (typeof valor === "string") return { stringValue: valor };
  if (typeof valor === "boolean") return { booleanValue: valor };
  if (typeof valor === "number") {
    return Number.isInteger(valor) ? { integerValue: String(valor) } : { doubleValue: valor };
  }
  if (Array.isArray(valor)) return { arrayValue: { values: valor.map(aFirestore) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aFirestore(v)])) } };
}

async function crearEnFirestore(fb, coleccion, id, datos) {
  const url = urlFirestore(fb, coleccion, id);
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: aFirestore(datos).mapValue.fields }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
  return r.json();
}

/* --- Almacén -------------------------------------------------------------- */

export function crearAlmacen(config) {
  const modo = config?.datos?.modo || "local";
  const api = config?.datos?.api || {};
  const fb = config?.datos?.firebase || {};
  const negocio = config?.id || "sin-configurar";

  async function guardar(tipo, datos, { prefijo, endpoint, coleccion }) {
    const registro = {
      id: referencia(prefijo),
      tipo,
      negocio,
      sector: config?.sector || "",
      creado: new Date().toISOString(),
      ...datos,
    };
    const copiaLocal = guardarLocal(registro);
    // En modo local no se intenta enviar nada: es una demo, y así funciona
    // igual de bien enseñándola sin cobertura en el móvil del cliente.
    if (modo === "local") {
      return { ok: true, id: registro.id, modo: "local", enviado: false, copiaLocal, registro };
    }
    try {
      if (modo === "firebase" && fb.projectId) {
        await crearEnFirestore(fb, coleccion, registro.id, registro);
        return { ok: true, id: registro.id, modo: "firebase", enviado: true, copiaLocal, registro };
      }
      if (modo === "api" && endpoint) {
        await enviarJson(endpoint, registro);
        return { ok: true, id: registro.id, modo: "api", enviado: true, copiaLocal, registro };
      }
      // Modo remoto mal configurado: no se pierde nada, queda la copia local.
      return { ok: true, id: registro.id, modo: "local", enviado: false, copiaLocal, registro,
        aviso: "Guardado solo en este dispositivo: falta configurar el destino en negocio.json." };
    } catch (e) {
      return { ok: true, id: registro.id, modo: "local", enviado: false, copiaLocal, registro,
        aviso: `No se pudo enviar (${String(e.message || e)}). Queda guardado aquí; mándalo por WhatsApp o teléfono.` };
    }
  }

  return {
    modo,
    guardarPedido: (pedido) => guardar("pedido", pedido, { prefijo: "PED", endpoint: api.pedido, coleccion: fb.coleccionPedidos || "pedidos" }),
    guardarReserva: (reserva) => guardar("reserva", reserva, { prefijo: "RES", endpoint: api.reserva, coleccion: fb.coleccionReservas || "reservas" }),
    // Los leads del propio monorepo van a /api/lead, que ya valida el correo.
    guardarLead: async (lead) => {
      const registro = { id: referencia("LEAD"), tipo: "lead", negocio, creado: new Date().toISOString(), ...lead };
      const copiaLocal = guardarLocal(registro);
      const destino = api.lead;
      if (modo === "local" || !destino) {
        return { ok: true, id: registro.id, modo: "local", enviado: false, copiaLocal, registro };
      }
      try {
        if (modo === "firebase" && fb.projectId) {
          await crearEnFirestore(fb, "leads", registro.id, registro);
        } else {
          await enviarJson(destino, {
            origen: lead.origen || `escaparate3d-pro:${negocio}`,
            nombre: lead.nombre || "",
            email: lead.email || "",
            telefono: lead.telefono || "",
            tipo: lead.tipo || "",
          });
        }
        return { ok: true, id: registro.id, modo, enviado: true, copiaLocal, registro };
      } catch (e) {
        return { ok: true, id: registro.id, modo: "local", enviado: false, copiaLocal, registro,
          aviso: `No se pudo registrar en el sistema (${String(e.message || e)}). Sigue valiendo el envío por WhatsApp o correo.` };
      }
    },
    historial: (tipo) => leerTodo().filter((r) => (tipo ? r.tipo === tipo : true) && r.negocio === negocio),
    borrarHistorial: () => {
      try { localStorage.removeItem(CLAVE); return true; } catch { return false; }
    },
  };
}
