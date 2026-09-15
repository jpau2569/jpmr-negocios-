import "server-only";

import { createHash } from "node:crypto";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { entornoServidor } from "@/lib/entorno";

/**
 * Cupo de peticiones para los formularios públicos.
 *
 * Se apoya en la función `consumir_cupo` de Postgres porque en Vercel cada
 * petición puede tocar una instancia distinta: un contador en memoria sería
 * trivial de saltar. La memoria local queda solo como red de seguridad si la
 * base de datos no responde — mejor un límite aproximado que ninguno.
 */

const memoria = new Map<string, { contador: number; inicio: number }>();

function cupoEnMemoria(clave: string, limite: number, ventanaSegundos: number): boolean {
  const ahora = Date.now();
  const actual = memoria.get(clave);
  if (!actual || ahora - actual.inicio > ventanaSegundos * 1000) {
    memoria.set(clave, { contador: 1, inicio: ahora });
    return true;
  }
  actual.contador += 1;
  return actual.contador <= limite;
}

/**
 * Hash con sal del identificador (normalmente la IP). Guardamos el hash, nunca
 * la IP: sirve para contar y limitar abuso sin fichar a quien escanea un cartel.
 */
export function hashIdentificador(valor: string): string {
  const { salConsentimiento } = entornoServidor();
  return createHash("sha256").update(`${salConsentimiento}:${valor}`).digest("hex").slice(0, 32);
}

export function ipDePeticion(peticion: Request): string {
  const cabeceras = peticion.headers;
  const reenviada = cabeceras.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0]!.trim();
  return cabeceras.get("x-real-ip") ?? cabeceras.get("cf-connecting-ip") ?? "desconocida";
}

export interface OpcionesCupo {
  ambito: string;
  identificador: string;
  limite?: number;
  ventanaSegundos?: number;
}

export async function dentroDelCupo({
  ambito,
  identificador,
  limite = 5,
  ventanaSegundos = 600,
}: OpcionesCupo): Promise<boolean> {
  const clave = `${ambito}:${hashIdentificador(identificador)}`;
  try {
    const supabase = clienteAdmin();
    const { data, error } = await supabase.rpc("consumir_cupo", {
      p_clave: clave,
      p_limite: limite,
      p_ventana_segundos: ventanaSegundos,
    });
    if (error) throw error;
    return data === true;
  } catch {
    return cupoEnMemoria(clave, limite, ventanaSegundos);
  }
}
