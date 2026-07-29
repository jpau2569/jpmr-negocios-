// ============================================================================
//  Memoria en la nube de Clara (Supabase)
// ----------------------------------------------------------------------------
//  La memoria vive en una tabla de Supabase con RLS activado y SIN políticas:
//  solo se puede tocar a través de funciones RPC "security definer" que
//  validan la clave de sincronización de Pau. La clave anónima de Supabase es
//  publicable por diseño; el secreto real es la clave de sincronización, que
//  Pau escribe una vez en cada dispositivo y jamás se guarda en el código.
//
//  Variables de entorno (Vercel):
//   - SUPABASE_URL       p. ej. https://xxxxx.supabase.co
//   - SUPABASE_ANON_KEY  la clave "anon" del proyecto
// ============================================================================

export function nubeConfigurada() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export async function rpc(fn, args) {
  const clave = process.env.SUPABASE_ANON_KEY;
  const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: clave,
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    const err = new Error(
      detalle.includes("incorrecta")
        ? "clave de sincronización incorrecta"
        : `Supabase respondió ${resp.status}`
    );
    err.status = resp.status;
    throw err;
  }
  // Las funciones que devuelven texto llegan como JSON (string entrecomillado).
  const texto = await resp.text();
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export const leerMemoria = (clave) => rpc("clara_memoria_lee", { clave });
export const guardarMemoria = (clave, nuevo) => rpc("clara_memoria_guarda", { clave, nuevo });
export const apuntarNota = (clave, nota) => rpc("clara_memoria_apunta", { clave, nota });
