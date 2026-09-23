import { qrPng, qrSvg, cartelA5, cartelA4Inmueble, cartelMesa, urlDeQr } from "@/lib/qr";
import { leerEspacio, inmueblePorSlug } from "@/lib/datos";
import { precioInmueble, resumenInmueble } from "@/components/publico/inmueble";
import { ESTADO_OPERACION_ES } from "@/types/negocio";
import { colorValido } from "@/lib/utils";

// ============================================================================
//  QR y carteles — /api/qr/[token]
// ----------------------------------------------------------------------------
//  Devuelve el QR de un punto concreto (mesa, barra, ticket, escaparate) en el
//  formato que se pida:
//
//    ?formato=png      imagen suelta, para pegar en un cartel de Word
//    ?formato=svg      vectorial, para imprenta
//    ?formato=a5       cartel A5 completo, listo para imprimir
//    ?formato=a4       cartel A4 de UN inmueble, para el escaparate
//    ?formato=mesa     pegatina de 70×90 mm para el pie de mesa
//
//  Todos llevan los colores del negocio, así que el cartel que sale no
//  desentona con el local.
// ============================================================================

export const runtime = "nodejs";

interface Props {
  params: Promise<{ token: string }>;
}

const DESTINOS: Record<string, { ruta: string; titulo: string; reclamo: string }> = {
  landing: { ruta: "", titulo: "Carta y reservas", reclamo: "Todo en tu móvil" },
  menu: { ruta: "menu", titulo: "La carta", reclamo: "Mira la carta en tu móvil" },
  daily_menu: { ruta: "daily_menu", titulo: "Menú del día", reclamo: "El menú de hoy, aquí" },
  reservation: { ruta: "reservation", titulo: "Reservar mesa", reclamo: "Reserva en 30 segundos" },
  group: { ruta: "group", titulo: "Grupos y celebraciones", reclamo: "¿Celebras algo? Cuéntanos" },
  review: { ruta: "review", titulo: "Tu opinión", reclamo: "¿Qué tal ha ido?" },
  // Inmobiliaria.
  listings: { ruta: "listings", titulo: "Nuestra cartera", reclamo: "Todos nuestros inmuebles" },
  valuation: { ruta: "valuation", titulo: "¿Cuánto vale el tuyo?", reclamo: "Valoración sin compromiso" },
  property: { ruta: "property", titulo: "Este inmueble", reclamo: "Fotos, datos y pedir visita" },
};

export async function GET(peticion: Request, { params }: Props) {
  const { token } = await params;
  const url = new URL(peticion.url);
  const formato = url.searchParams.get("formato") ?? "png";
  const slug = url.searchParams.get("negocio") ?? "";
  const destino = url.searchParams.get("destino") ?? "landing";
  const etiqueta = url.searchParams.get("etiqueta") ?? "";
  // Solo para destino "property": qué inmueble concreto.
  const refInmueble = url.searchParams.get("inmueble") ?? "";

  if (!/^[a-zA-Z0-9_-]{4,32}$/.test(token)) {
    return new Response("Token no válido", { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
    return new Response("Falta el negocio", { status: 400 });
  }

  const espacio = await leerEspacio(slug);
  if (!espacio) return new Response("Negocio no encontrado", { status: 404 });

  // Un QR por inmueble necesita saber a qué inmueble apunta. Si se pide uno y
  // el inmueble no existe (o no es público), se responde 404 en vez de generar
  // un cartel que lleva a ninguna parte: eso se imprimiría y no tiene arreglo.
  const inmueble = destino === "property" && refInmueble
    ? inmueblePorSlug(espacio, refInmueble)
    : null;
  if (destino === "property" && !inmueble) {
    return new Response("Ese inmueble no existe o no es público", { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const enlace = urlDeQr(
    base, slug, token,
    DESTINOS[destino]?.ruta || undefined,
    inmueble?.slug,
  );

  const tema = espacio.ajustes.theme ?? {};
  const datosCartel = {
    url: enlace,
    negocio: espacio.negocio.name,
    titulo: etiqueta || DESTINOS[destino]?.titulo || "Carta digital",
    reclamo: DESTINOS[destino]?.reclamo,
    pie: espacio.ajustes.address ?? "",
    colorFondo: colorValido(tema.fondo, "#17181b"),
    colorTinta: colorValido(tema.texto, "#f3efe6"),
    colorAcento: colorValido(tema.acento, "#d4a03c"),
  };

  // Cacheable: un QR de un token dado no cambia nunca.
  const cabeceras = { "Cache-Control": "public, max-age=86400, s-maxage=604800" };

  if (formato === "svg") {
    return new Response(qrSvg(enlace), {
      headers: { ...cabeceras, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }

  // El A4 de escaparate es el cartel de UN inmueble: lleva su precio, sus
  // datos y su propio QR, que es lo que permite medirlo piso a piso.
  if (formato === "a4") {
    if (!inmueble) {
      return new Response(
        "El cartel A4 es de un inmueble: añade &destino=property&inmueble=<slug>",
        { status: 400 },
      );
    }
    const svg = cartelA4Inmueble({
      ...datosCartel,
      titulo: etiqueta || inmueble.title,
      precio: precioInmueble(inmueble),
      resumen: resumenInmueble(inmueble),
      referencia: inmueble.reference,
      sello: inmueble.deal_state === "disponible"
        ? ""
        : ESTADO_OPERACION_ES[inmueble.deal_state],
    });
    return new Response(svg, {
      headers: {
        ...cabeceras,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug}-${inmueble.reference}-A4.svg"`,
      },
    });
  }

  if (formato === "a5" || formato === "mesa") {
    const svg = formato === "a5" ? cartelA5(datosCartel) : cartelMesa(datosCartel);
    return new Response(svg, {
      headers: {
        ...cabeceras,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="${slug}-${token}-${formato}.svg"`,
      },
    });
  }

  const png = qrPng(enlace, { escala: Number(url.searchParams.get("escala")) || 10 });
  return new Response(new Uint8Array(png), {
    headers: {
      ...cabeceras,
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${slug}-${token}.png"`,
    },
  });
}
