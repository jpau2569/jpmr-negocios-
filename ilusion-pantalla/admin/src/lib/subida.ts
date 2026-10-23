// Subida de archivos: Edge Function `admin-subida` → PUT directo a R2.
import { ANON_KEY_PUBLICA, SUPABASE_URL, supabase } from "./supabase";
import { validarArchivo, type TipoSubida } from "./archivo";

export interface RespuestaSubida {
  url: string;
  clave: string;
  bucket: string;
  cabeceras: Record<string, string>;
  url_publica: string | null;
}

export async function sha256Hex(f: Blob): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface OpcionesSubida {
  slug: string;
  tipo: TipoSubida;
  calidad?: string;
  codec?: string;
  archivo: File;
  alProgreso?: (pct: number) => void;
}

/** Valida, pide la URL firmada, sube y devuelve lo que hay que registrar. */
export async function subirArchivo(o: OpcionesSubida): Promise<RespuestaSubida> {
  const v = validarArchivo({ slug: o.slug, tipo: o.tipo, calidad: o.calidad, codec: o.codec, mime: o.archivo.type, bytes: o.archivo.size });
  if (!v.ok) throw new Error(v.error);

  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");

  const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-subida`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY_PUBLICA, "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: o.slug, tipo: o.tipo, calidad: o.calidad, codec: o.codec, mime: o.archivo.type, bytes: o.archivo.size,
    }),
  });
  const cuerpo = (await r.json().catch(() => ({}))) as Partial<RespuestaSubida> & { error?: string };
  if (!r.ok || !cuerpo.url || !cuerpo.clave) throw new Error(cuerpo.error ?? `No se pudo preparar la subida (${r.status}).`);
  const resp = cuerpo as RespuestaSubida;
  if (resp.clave !== v.clave) throw new Error("El servidor devolvió una clave distinta de la esperada. Subida cancelada.");

  await new Promise<void>((ok, ko) => {
    const x = new XMLHttpRequest();
    x.open("PUT", resp.url);
    for (const [k, val] of Object.entries(resp.cabeceras ?? {})) x.setRequestHeader(k, val);
    x.upload.onprogress = (ev) => ev.lengthComputable && o.alProgreso?.(Math.round((100 * ev.loaded) / ev.total));
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : ko(new Error(`El almacenamiento rechazó el archivo (${x.status}).`)));
    x.onerror = () => ko(new Error("Fallo de red al subir (¿CORS del bucket sin configurar?)."));
    x.send(o.archivo);
  });
  return resp;
}
