import Image from "next/image";
import Link from "next/link";
import { Icono } from "@/components/ui/icono";
import { EnlaceMedido } from "@/components/publico/rastreador";
import { enlaceLlamada, enlaceMapa, enlaceWhatsapp } from "@/lib/formato";
import type { NegocioPublico } from "@/types/dominio";

/**
 * Cabecera de la landing pública.
 *
 * Orden pensado para quien acaba de escanear un QR y está de pie en la calle:
 * primero quién eres, después dónde estás y por último cómo te escribe. Los tres
 * botones de acción van juntos y son grandes porque son el 80 % de los toques.
 */
export function CabeceraNegocio({ negocio }: { negocio: NegocioPublico }) {
  const whatsapp = enlaceWhatsapp(
    negocio.whatsapp_phone,
    `Hola, os escribo desde la página de ${negocio.name}.`,
  );
  const llamada = enlaceLlamada(negocio.phone);
  const mapa = enlaceMapa(negocio.address, negocio.city);
  const horario = Object.entries(negocio.opening_hours ?? {}).filter(([clave]) => clave !== "aviso");
  const redes = Object.entries(negocio.social_links ?? {});

  return (
    <header className="relative">
      <div className="relative h-44 w-full overflow-hidden bg-[var(--marca)] sm:h-60">
        {negocio.cover_url ? (
          <Image
            src={negocio.cover_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-90"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--marca)_88%,transparent)] to-transparent" />
      </div>

      <div className="mx-auto -mt-12 max-w-3xl px-4">
        <div className="animar-entrada rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {negocio.logo_url ? (
              <Image
                src={negocio.logo_url}
                alt={`Logotipo de ${negocio.name}`}
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--marca)] text-xl font-bold text-[var(--marca-contraste)]"
              >
                {negocio.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                <Link href={`/b/${negocio.slug}`}>{negocio.name}</Link>
              </h1>
              {negocio.tagline ? <p className="mt-1 text-sm text-[var(--texto-suave)]">{negocio.tagline}</p> : null}
              {negocio.founded_note ? (
                <p className="mt-1 text-xs font-semibold tracking-wide text-[var(--acento)] uppercase">
                  {negocio.founded_note}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="mt-4 space-y-2 text-sm text-[var(--texto-suave)]">
            {negocio.address ? (
              <div className="flex items-start gap-2">
                <dt className="sr-only">Dirección</dt>
                <Icono nombre="mapa" className="mt-0.5 size-4 shrink-0" />
                <dd>
                  {negocio.address}
                  {negocio.postal_code || negocio.city ? `, ${[negocio.postal_code, negocio.city].filter(Boolean).join(" ")}` : ""}
                </dd>
              </div>
            ) : null}
            {horario.length ? (
              <div className="flex items-start gap-2">
                <dt className="sr-only">Horario</dt>
                <Icono nombre="reloj" className="mt-0.5 size-4 shrink-0" />
                <dd>
                  {horario.map(([dia, valor]) => (
                    <span key={dia} className="block">
                      <span className="capitalize">{dia.replace(/_/g, " a ")}</span>: {valor}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {llamada ? (
              <EnlaceMedido
                slug={negocio.slug}
                tipo="call_click"
                href={llamada}
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radio)] bg-[var(--marca)] text-xs font-semibold text-[var(--marca-contraste)]"
              >
                <Icono nombre="telefono" className="size-5" />
                Llamar
              </EnlaceMedido>
            ) : null}
            {whatsapp ? (
              <EnlaceMedido
                slug={negocio.slug}
                tipo="whatsapp_click"
                href={whatsapp}
                externo
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radio)] bg-[var(--acento)] text-xs font-semibold text-[var(--acento-contraste)]"
              >
                <Icono nombre="whatsapp" className="size-5" />
                WhatsApp
              </EnlaceMedido>
            ) : null}
            {mapa ? (
              <EnlaceMedido
                slug={negocio.slug}
                tipo="directions_click"
                href={mapa}
                externo
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-[var(--radio)] border border-[var(--borde)] text-xs font-semibold"
              >
                <Icono nombre="mapa" className="size-5" />
                Cómo llegar
              </EnlaceMedido>
            ) : null}
          </div>

          {(negocio.website_url || redes.length) ? (
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--texto-suave)]">
              {negocio.website_url ? (
                <a
                  href={negocio.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  Web oficial
                </a>
              ) : null}
              {redes.map(([red, url]) => (
                <a key={red} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 capitalize">
                  {red}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
