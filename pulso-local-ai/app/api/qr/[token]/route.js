import { qrPng, qrSvg, cartelA5, cartelMesa, urlDeQr } from "@/lib/qr";
import { leerEspacio } from "@/lib/datos";
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
//    ?formato=mesa     pegatina de 70×90 mm para el pie de mesa
//
//  Todos llevan los colores del negocio, así que el cartel que sale no
//  desentona con el local.
// ============================================================================
export const runtime = "nodejs";
const DESTINOS = {
    landing: { ruta: "", titulo: "Carta y reservas", reclamo: "Todo en tu móvil" },
    menu: { ruta: "menu", titulo: "La carta", reclamo: "Mira la carta en tu móvil" },
    daily_menu: { ruta: "daily_menu", titulo: "Menú del día", reclamo: "El menú de hoy, aquí" },
    reservation: { ruta: "reservation", titulo: "Reservar mesa", reclamo: "Reserva en 30 segundos" },
    group: { ruta: "group", titulo: "Grupos y celebraciones", reclamo: "¿Celebras algo? Cuéntanos" },
    review: { ruta: "review", titulo: "Tu opinión", reclamo: "¿Qué tal ha ido?" },
};
export async function GET(peticion, { params }) {
    const { token } = await params;
    const url = new URL(peticion.url);
    const formato = url.searchParams.get("formato") ?? "png";
    const slug = url.searchParams.get("negocio") ?? "";
    const destino = url.searchParams.get("destino") ?? "landing";
    const etiqueta = url.searchParams.get("etiqueta") ?? "";
    if (!/^[a-zA-Z0-9_-]{4,32}$/.test(token)) {
        return new Response("Token no válido", { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
        return new Response("Falta el negocio", { status: 400 });
    }
    const espacio = await leerEspacio(slug);
    if (!espacio)
        return new Response("Negocio no encontrado", { status: 404 });
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
    const enlace = urlDeQr(base, slug, token, DESTINOS[destino]?.ruta || undefined);
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
