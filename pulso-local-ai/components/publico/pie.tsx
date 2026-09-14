import Link from "next/link";
import { horarioLegible } from "@/lib/horarios";
import { enlaceMapa, enlaceTelefono } from "@/lib/whatsapp";
import { haySinConfirmar } from "@/lib/datos";
import { estadoDemo } from "@/lib/trial";
import { Rastreador } from "./rastreador";
import type { EspacioNegocio } from "@/types/negocio";

// ============================================================================
//  Pie
// ----------------------------------------------------------------------------
//  Además de contacto y horario, el pie es donde se cumple la regla de oro del
//  producto: si queda contenido sin confirmar por el negocio, SE DICE. Y si el
//  espacio es una demo, también.
// ============================================================================

const REDES: { clave: keyof EspacioNegocio["ajustes"]; nombre: string }[] = [
  { clave: "website", nombre: "Web" },
  { clave: "instagram", nombre: "Instagram" },
  { clave: "facebook", nombre: "Facebook" },
  { clave: "tiktok", nombre: "TikTok" },
];

export function Pie({ espacio }: { espacio: EspacioNegocio }) {
  const { negocio, ajustes } = espacio;
  const base = `/b/${negocio.slug}`;
  const horario = horarioLegible(ajustes.opening_hours ?? []);
  const tel = enlaceTelefono(ajustes.phone);
  const mapa = enlaceMapa(ajustes.address, ajustes.lat, ajustes.lng);
  const demo = estadoDemo(negocio);
  const sinConfirmar = haySinConfirmar(espacio);

  const redes = REDES
    .map((r) => ({ ...r, url: ajustes[r.clave] as string | null }))
    .filter((r): r is { clave: keyof EspacioNegocio["ajustes"]; nombre: string; url: string } =>
      typeof r.url === "string" && r.url.startsWith("http"));

  return (
    <footer className="border-t border-[var(--negocio-borde)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-3xl gap-8 sm:grid-cols-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-base">{negocio.name}</h3>
          {ajustes.address ? (
            <p className="mt-2 text-sm text-[var(--negocio-tenue)]">{ajustes.address}</p>
          ) : null}
          {mapa ? (
            <Rastreador evento="directions_click">
              <a href={mapa} target="_blank" rel="noopener" className="mt-2 inline-block text-sm underline underline-offset-4">
                Cómo llegar
              </a>
            </Rastreador>
          ) : null}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Contacto</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--negocio-tenue)]">
            {tel ? (
              <li>
                <Rastreador evento="call_click">
                  <a href={tel} className="underline underline-offset-4">{ajustes.phone}</a>
                </Rastreador>
              </li>
            ) : null}
            {ajustes.email ? (
              <li><a href={`mailto:${ajustes.email}`} className="underline underline-offset-4">{ajustes.email}</a></li>
            ) : null}
            <li><Link href={`${base}/opinion`} className="underline underline-offset-4">Dejar tu opinión</Link></li>
          </ul>

          {redes.length > 0 ? (
            <>
              <h3 className="mt-5 text-sm font-semibold">En internet</h3>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--negocio-tenue)]">
                {redes.map((r) => (
                  <li key={r.clave}>
                    <a href={r.url} target="_blank" rel="noopener" className="underline underline-offset-4">
                      {r.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div>
          {horario.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold">Horario</h3>
              <ul className="mt-2 space-y-0.5 text-xs text-[var(--negocio-tenue)]">
                {horario.map((linea) => <li key={linea}>{linea}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-xs text-[var(--negocio-tenue)]">
              El horario todavía no está confirmado por el local. Llama antes de venir.
            </p>
          )}
        </div>
      </div>

      {/* Honestidad por delante: se ve en la propia página, no solo en un JSON. */}
      {(demo.esDemo || sinConfirmar) && (
        <div className="mx-auto mt-8 w-full max-w-3xl rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3">
          <p className="text-sm font-semibold text-amber-200">
            {demo.esDemo ? "Demostración · datos por confirmar" : "Datos por confirmar"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/75">
            {demo.esDemo
              ? `Esta página es una demostración de Pulso Local AI para ${negocio.name}. `
              : ""}
            {sinConfirmar
              ? "Hay platos, precios o menús marcados como muestra: el negocio los confirma antes de publicar. Para cualquier dato concreto —precio, alérgenos o disponibilidad— pregunta en el local."
              : ""}
          </p>
        </div>
      )}

      <p className="mx-auto mt-8 w-full max-w-3xl text-center text-[0.7rem] text-[var(--negocio-tenue)]">
        Hecho con <span className="font-semibold">Pulso Local AI</span> · El QR que convierte visitas en clientes que vuelven
      </p>
    </footer>
  );
}
