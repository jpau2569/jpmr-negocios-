// ============================================================================
//  OPORTUNIDADES ÚNICAS — backend (Vercel + Supabase)
// ----------------------------------------------------------------------------
//  El navegador NUNCA habla con Supabase: habla con este endpoint, y este
//  endpoint habla con Supabase. Así ninguna clave sale al cliente y todas las
//  entradas pasan por la validación de `lib/oportunidades.js`.
//
//  Sesiones: las gestiona Supabase Auth (correo y contraseña de verdad, con
//  recuperación). El navegador guarda el `access_token` y lo manda en cada
//  petición; aquí se reenvía a PostgREST, de modo que las políticas RLS del
//  esquema deciden qué puede ver cada persona. Si alguien se cuela con un
//  token manipulado, Supabase lo rechaza: no dependemos de comprobarlo aquí.
//
//  Variables de entorno (Vercel → Settings → Environment Variables):
//    SUPABASE_URL           https://xxxxx.supabase.co
//    SUPABASE_ANON_KEY      clave "anon" (publicable por diseño)
//    SUPABASE_SERVICE_KEY   clave "service_role" — SECRETA. Solo se usa para
//                           el portal del comprador, que se identifica con un
//                           token opaco y no tiene sesión de Supabase.
// ============================================================================

import {
  normalizarInmueble,
  normalizarCliente,
  mejoresClientes,
  tokenPortal,
  mensajeWhatsapp,
  texto,
  ESTADOS,
  OPERACIONES,
  RESPUESTAS_PORTAL,
} from "../lib/oportunidades.js";

const TIEMPO_LIMITE = 12000;

export function nubeConfigurada() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// ---------------------------------------------------------------------------
//  Llamadas a Supabase
// ---------------------------------------------------------------------------
async function llamar(ruta, { metodo = "GET", token, cuerpo, prefer, servicio = false } = {}) {
  const anon = process.env.SUPABASE_ANON_KEY;
  const clave = servicio ? process.env.SUPABASE_SERVICE_KEY || anon : anon;
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIEMPO_LIMITE);
  let resp;
  try {
    resp = await fetch(`${process.env.SUPABASE_URL}${ruta}`, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        apikey: clave,
        Authorization: `Bearer ${token || clave}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch (e) {
    const err = new Error(
      e?.name === "AbortError"
        ? "La base de datos ha tardado demasiado. Inténtalo otra vez."
        : `No se pudo conectar con la base de datos: ${e?.message || e}`
    );
    err.status = 504;
    throw err;
  } finally {
    clearTimeout(alarma);
  }

  const bruto = await resp.text();
  let datos = null;
  try {
    datos = bruto ? JSON.parse(bruto) : null;
  } catch {
    datos = bruto;
  }
  if (!resp.ok) {
    const err = new Error(datos?.message || datos?.error_description || datos?.msg || `Supabase respondió ${resp.status}`);
    err.status = resp.status;
    err.detalle = datos;
    throw err;
  }
  return datos;
}

const tabla = (nombre, consulta, opciones) => llamar(`/rest/v1/${nombre}${consulta || ""}`, opciones);
const rpcServicio = (fn, args) =>
  llamar(`/rest/v1/rpc/${fn}`, { metodo: "POST", cuerpo: args, servicio: true });

/** El token del usuario viaja en la cabecera Authorization, como es estándar. */
function tokenDe(req) {
  const h = String(req.headers?.authorization || req.headers?.Authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function perfilDe(token) {
  if (!token) return null;
  const filas = await tabla("ou_usuarios", "?select=id,nombre,email,rol,activo&limit=1", { token });
  const u = Array.isArray(filas) ? filas[0] : null;
  return u && u.activo ? u : null;
}

// ---------------------------------------------------------------------------
//  Acciones
// ---------------------------------------------------------------------------
const CAMPOS_INMUEBLE =
  "id,referencia,titulo,operacion,precio,ciudad,zona,codigo_postal,provincia,direccion_privada," +
  "habitaciones,banos,metros,caracteristicas,etiquetas,descripcion,estado,agente_id,publico,slug," +
  "portada_url,fotos,creado,actualizado";

const CAMPOS_CLIENTE =
  "id,nombre,apellidos,telefono,email,tipo,operacion,presupuesto_max,zonas,habitaciones_min," +
  "metros_min,necesita,notas,agente_id,token_portal,inmuebles_autorizados,anonimizado,ultimo_contacto,creado";

async function accionLogin(cuerpo) {
  const email = texto(cuerpo.email, 120).toLowerCase();
  const password = String(cuerpo.password ?? "");
  if (!email || !password) {
    return { estado: 400, cuerpo: { error: "Escribe tu correo y tu contraseña." } };
  }

  let sesion;
  try {
    sesion = await llamar("/auth/v1/token?grant_type=password", {
      metodo: "POST",
      cuerpo: { email, password },
    });
  } catch (e) {
    // Supabase distingue credenciales malas (400) de un problema suyo.
    if (e.status === 400) {
      return { estado: 401, cuerpo: { error: "Correo o contraseña incorrectos." } };
    }
    throw e;
  }

  const perfil = await perfilDe(sesion.access_token);
  if (!perfil) {
    return {
      estado: 403,
      cuerpo: {
        error:
          "Tu usuario existe pero todavía no está dado de alta en el despacho. Pídele a un administrador que te añada.",
      },
    };
  }

  return {
    estado: 200,
    cuerpo: {
      token: sesion.access_token,
      refresco: sesion.refresh_token,
      expira: sesion.expires_at,
      usuario: perfil,
    },
  };
}

async function accionPanel(token, perfil) {
  const [inmuebles, tareas, actividad] = await Promise.all([
    tabla("ou_inmuebles", `?select=${CAMPOS_INMUEBLE}&order=actualizado.desc&limit=6`, { token }),
    tabla("ou_tareas", "?select=id,titulo,estado,vence,cliente_id,inmueble_id&estado=eq.pendiente&order=vence.asc&limit=8", { token }),
    tabla("ou_actividad", "?select=id,tipo,resumen,creado,autor_nombre&order=creado.desc&limit=10", { token }),
  ]);

  const total = await tabla("ou_inmuebles", "?select=id,estado", { token });
  const cuenta = (estado) => total.filter((i) => i.estado === estado).length;

  return {
    estado: 200,
    cuerpo: {
      usuario: perfil,
      metricas: {
        disponibles: cuenta("disponible"),
        borradores: cuenta("borrador"),
        reservados: cuenta("reservado"),
        vendidos: cuenta("vendido"),
        total: total.length,
      },
      inmuebles,
      tareas,
      actividad,
    },
  };
}

async function accionInmueblesListar(token, cuerpo) {
  const filtros = [];
  const estado = String(cuerpo.estado || "").trim();
  if (ESTADOS.some((e) => e.id === estado)) filtros.push(`estado=eq.${estado}`);
  const operacion = String(cuerpo.operacion || "").trim();
  if (OPERACIONES.includes(operacion)) filtros.push(`operacion=eq.${operacion}`);
  const busca = texto(cuerpo.busca, 60);
  if (busca) {
    // `or` de PostgREST: título, referencia, ciudad o zona.
    const patron = encodeURIComponent(`*${busca}*`);
    filtros.push(`or=(titulo.ilike.${patron},referencia.ilike.${patron},ciudad.ilike.${patron},zona.ilike.${patron})`);
  }
  const consulta = `?select=${CAMPOS_INMUEBLE}&order=actualizado.desc&limit=200${filtros.length ? "&" + filtros.join("&") : ""}`;
  return { estado: 200, cuerpo: { inmuebles: await tabla("ou_inmuebles", consulta, { token }) } };
}

async function accionInmuebleGuardar(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }

  // La referencia automática necesita saber cuántos hay para seguir la serie.
  const existentes = await tabla("ou_inmuebles", "?select=id&limit=1000", { token });
  const { ok, errores, inmueble } = normalizarInmueble(cuerpo.inmueble || {}, {
    secuencia: existentes.length + 1,
  });
  if (!ok) return { estado: 400, cuerpo: { error: errores.join(" "), errores } };

  const id = texto(cuerpo.id, 40);
  let guardado;
  if (id) {
    const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}`, {
      metodo: "PATCH",
      token,
      cuerpo: inmueble,
      prefer: "return=representation",
    });
    guardado = filas[0];
    if (!guardado) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };
  } else {
    const filas = await tabla("ou_inmuebles", `?select=${CAMPOS_INMUEBLE}`, {
      metodo: "POST",
      token,
      cuerpo: { ...inmueble, agente_id: perfil.id },
      prefer: "return=representation",
    });
    guardado = filas[0];
  }

  await apuntar(token, perfil, {
    tipo: id ? "inmueble_editado" : "inmueble_nuevo",
    resumen: `${id ? "Actualizado" : "Nuevo inmueble"}: ${guardado.titulo} (${guardado.referencia})`,
    inmueble_id: guardado.id,
  });

  return { estado: 200, cuerpo: { inmueble: guardado } };
}

async function accionClientesListar(token) {
  return {
    estado: 200,
    cuerpo: {
      clientes: await tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}&anonimizado=is.false&order=creado.desc&limit=300`, { token }),
    },
  };
}

async function accionClienteGuardar(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const { ok, errores, cliente } = normalizarCliente(cuerpo.cliente || {});
  if (!ok) return { estado: 400, cuerpo: { error: errores.join(" "), errores } };

  const id = texto(cuerpo.id, 40);
  let guardado;
  if (id) {
    const filas = await tabla("ou_clientes", `?id=eq.${id}&select=${CAMPOS_CLIENTE}`, {
      metodo: "PATCH",
      token,
      cuerpo: cliente,
      prefer: "return=representation",
    });
    guardado = filas[0];
    if (!guardado) return { estado: 404, cuerpo: { error: "Ese cliente ya no existe." } };
  } else {
    const filas = await tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}`, {
      metodo: "POST",
      token,
      cuerpo: { ...cliente, agente_id: perfil.id, token_portal: tokenPortal() },
      prefer: "return=representation",
    });
    guardado = filas[0];
  }

  await apuntar(token, perfil, {
    tipo: id ? "cliente_editado" : "cliente_nuevo",
    resumen: `${id ? "Actualizado" : "Nuevo cliente"}: ${guardado.nombre}`,
    cliente_id: guardado.id,
  });

  return { estado: 200, cuerpo: { cliente: guardado } };
}

/** Los clientes que mejor encajan con un inmueble — el cálculo está en lib/. */
async function accionCoincidencias(token, cuerpo) {
  const id = texto(cuerpo.id, 40);
  if (!id) return { estado: 400, cuerpo: { error: "Falta el inmueble." } };
  const [inmuebles, clientes] = await Promise.all([
    tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}&limit=1`, { token }),
    tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}&anonimizado=is.false&limit=300`, { token }),
  ]);
  const inmueble = inmuebles[0];
  if (!inmueble) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };
  return { estado: 200, cuerpo: { inmueble, coincidencias: mejoresClientes(inmueble, clientes) } };
}

/** Prepara el envío al cliente: autoriza inmuebles, da enlace y mensaje. */
async function accionEnviarSeleccion(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const clienteId = texto(cuerpo.cliente_id, 40);
  const ids = (Array.isArray(cuerpo.inmuebles) ? cuerpo.inmuebles : []).map((i) => texto(i, 40)).filter(Boolean).slice(0, 50);
  if (!clienteId || !ids.length) {
    return { estado: 400, cuerpo: { error: "Elige un cliente y al menos un inmueble." } };
  }

  const clientes = await tabla("ou_clientes", `?id=eq.${clienteId}&select=${CAMPOS_CLIENTE}&limit=1`, { token });
  const cliente = clientes[0];
  if (!cliente) return { estado: 404, cuerpo: { error: "Ese cliente ya no existe." } };

  const token_portal = cliente.token_portal || tokenPortal();
  const autorizados = [...new Set([...(cliente.inmuebles_autorizados || []), ...ids])];
  const filas = await tabla("ou_clientes", `?id=eq.${clienteId}&select=${CAMPOS_CLIENTE}`, {
    metodo: "PATCH",
    token,
    cuerpo: { token_portal, inmuebles_autorizados: autorizados, ultimo_contacto: new Date().toISOString() },
    prefer: "return=representation",
  });

  const inmuebles = await tabla(
    "ou_inmuebles",
    `?id=in.(${ids.join(",")})&select=id,titulo,metros,habitaciones,precio,slug`,
    { token }
  );

  const base = texto(cuerpo.base_url, 200) || "";
  const enlacePortal = base ? `${base.replace(/\/+$/, "")}/oportunidades/portal.html#${token_portal}` : "";

  await apuntar(token, perfil, {
    tipo: "seleccion_enviada",
    resumen: `Selección de ${ids.length} inmueble(s) preparada para ${cliente.nombre}`,
    cliente_id: clienteId,
  });

  return {
    estado: 200,
    cuerpo: {
      cliente: filas[0],
      enlace: enlacePortal,
      mensaje: mensajeWhatsapp({
        cliente,
        inmuebles,
        enlacePortal,
        firma: { agente: perfil.nombre, empresa: "Asesoría Castresana" },
      }),
    },
  };
}

async function apuntar(token, perfil, { tipo, resumen, inmueble_id = null, cliente_id = null }) {
  try {
    await tabla("ou_actividad", "", {
      metodo: "POST",
      token,
      cuerpo: { tipo, resumen, inmueble_id, cliente_id, autor_id: perfil.id, autor_nombre: perfil.nombre },
      prefer: "return=minimal",
    });
  } catch (e) {
    // El historial es importante, pero no tanto como para tumbar la operación
    // que el usuario acaba de hacer. Queda en los registros del servidor.
    console.error("No se pudo apuntar la actividad:", String(e?.message || e));
  }
}

// ---- Sin sesión: ficha pública y portal del comprador ----------------------
async function accionFichaPublica(cuerpo) {
  const slug = texto(cuerpo.slug, 100);
  if (!slug) return { estado: 400, cuerpo: { error: "Falta la ficha." } };
  const filas = await tabla("ou_publico", `?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!filas.length) return { estado: 404, cuerpo: { error: "Esta ficha ya no está disponible." } };
  return { estado: 200, cuerpo: { inmueble: filas[0] } };
}

async function accionPortalLeer(cuerpo) {
  const token = texto(cuerpo.token, 64);
  const datos = await rpcServicio("ou_portal", { token_dado: token });
  if (!datos) return { estado: 404, cuerpo: { error: "Este enlace ya no es válido. Pídenos uno nuevo." } };
  return { estado: 200, cuerpo: datos };
}

async function accionPortalResponder(cuerpo) {
  const token = texto(cuerpo.token, 64);
  const slug = texto(cuerpo.slug, 100);
  const respuesta = texto(cuerpo.respuesta, 20);
  if (!RESPUESTAS_PORTAL.includes(respuesta)) {
    return { estado: 400, cuerpo: { error: "Respuesta no válida." } };
  }
  const salida = await rpcServicio("ou_portal_responde", {
    token_dado: token,
    slug_dado: slug,
    respuesta_dada: respuesta,
  });
  if (!salida?.ok) return { estado: 400, cuerpo: { error: salida?.error || "No se pudo registrar tu respuesta." } };
  return { estado: 200, cuerpo: { ok: true } };
}

// Acciones que no necesitan sesión del despacho.
const PUBLICAS = {
  login: (_t, _p, cuerpo) => accionLogin(cuerpo),
  ficha: (_t, _p, cuerpo) => accionFichaPublica(cuerpo),
  "portal.leer": (_t, _p, cuerpo) => accionPortalLeer(cuerpo),
  "portal.responder": (_t, _p, cuerpo) => accionPortalResponder(cuerpo),
};

const PRIVADAS = {
  perfil: (_t, perfil) => ({ estado: 200, cuerpo: { usuario: perfil } }),
  panel: (token, perfil) => accionPanel(token, perfil),
  "inmuebles.listar": (token, _p, cuerpo) => accionInmueblesListar(token, cuerpo),
  "inmuebles.guardar": (token, perfil, cuerpo) => accionInmuebleGuardar(token, perfil, cuerpo),
  "clientes.listar": (token) => accionClientesListar(token),
  "clientes.guardar": (token, perfil, cuerpo) => accionClienteGuardar(token, perfil, cuerpo),
  coincidencias: (token, _p, cuerpo) => accionCoincidencias(token, cuerpo),
  "seleccion.enviar": (token, perfil, cuerpo) => accionEnviarSeleccion(token, perfil, cuerpo),
};

// ---------------------------------------------------------------------------
//  Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error:
        "La base de datos no está configurada. Añade SUPABASE_URL y SUPABASE_ANON_KEY en Vercel → Settings → Environment Variables y vuelve a desplegar.",
    });
  }

  const cuerpo = req.body ?? {};
  const accion = String(cuerpo.accion || "").trim();
  res.setHeader("Cache-Control", "no-store");

  try {
    if (PUBLICAS[accion]) {
      const r = await PUBLICAS[accion](null, null, cuerpo);
      return res.status(r.estado).json(r.cuerpo);
    }

    if (!PRIVADAS[accion]) {
      return res.status(400).json({ error: "Acción no reconocida." });
    }

    const token = tokenDe(req);
    if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });

    let perfil;
    try {
      perfil = await perfilDe(token);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        return res.status(401).json({ error: "Tu sesión ha caducado. Vuelve a entrar." });
      }
      throw e;
    }
    if (!perfil) {
      return res.status(403).json({ error: "Tu usuario no tiene acceso al despacho." });
    }

    const r = await PRIVADAS[accion](token, perfil, cuerpo);
    return res.status(r.estado).json(r.cuerpo);
  } catch (e) {
    const estado = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (estado >= 500) console.error(`Error en /api/oportunidades (${accion}):`, e);
    return res.status(estado).json({ error: e.message || "Error interno." });
  }
}
