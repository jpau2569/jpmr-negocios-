import { leerEspacio, especialesVigentes } from "@/lib/datos";
import { esquemaPregunta } from "@/lib/schemas/formularios";
import { limitar, ipDe, bien, error } from "@/lib/api";
import { euros } from "@/lib/utils";
import { horarioLegible } from "@/lib/horarios";
import { ALERGENOS_ES } from "@/types/negocio";
// ============================================================================
//  Asistente "TheWhiteBar 24/7" — /api/ai/ask
// ----------------------------------------------------------------------------
//  La regla de oro, igual que en Chivato AI: EL ASISTENTE NO INVENTA. Responde
//  únicamente con lo que el negocio tiene PUBLICADO — carta, menú de hoy,
//  menús especiales, horario y FAQs. Si no lo sabe, lo dice y remite al local.
//
//  Por qué esto no es exceso de celo: si el asistente se inventa que un plato
//  no lleva gluten, el daño no es una mala reseña. Y si se inventa un precio,
//  el camarero tiene una discusión en la mesa.
//
//  En el MVP es un buscador sobre el contenido publicado, sin modelo de
//  lenguaje. El contrato de la respuesta ya está pensado para enchufar un
//  LLM con RAG detrás, pero mientras no haya ANTHROPIC_API_KEY configurada y
//  una capa de citas, no se llama a ningún modelo: un modelo suelto sobre
//  datos de alérgenos es exactamente lo que NO se debe hacer.
// ============================================================================
export const runtime = "nodejs";
const NO_LO_SE = "Para confirmarlo, contacta directamente con el local por teléfono o WhatsApp.";
const AVISO_ALERGIAS = "Indica siempre la alergia al personal para confirmar opciones y evitar contaminación cruzada.";
const sinAcentos = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const contiene = (texto, palabras) => palabras.some((p) => sinAcentos(texto).includes(sinAcentos(p)));
export async function POST(peticion) {
    let bruto;
    try {
        bruto = await peticion.json();
    }
    catch {
        return error("No he entendido la pregunta.");
    }
    const validado = esquemaPregunta.safeParse(bruto);
    if (!validado.success)
        return error(validado.error.issues[0]?.message ?? "Pregunta no válida.");
    const ip = ipDe(peticion);
    if (!limitar(`ia:${ip}:${validado.data.slug}`, 15)) {
        return error("Vas muy rápido. Espera un momento.", 429);
    }
    const espacio = await leerEspacio(validado.data.slug);
    if (!espacio)
        return error("Este espacio no está disponible.", 404);
    return bien({ respuesta: responder(validado.data.question, espacio) });
}
function responder(pregunta, espacio) {
    if (!espacio)
        return { texto: NO_LO_SE, fuentes: [] };
    const { negocio, ajustes, menuDeHoy, platos } = espacio;
    const q = pregunta;
    /* --- Menú del día --- */
    if (contiene(q, ["menu del dia", "menú del día", "hay hoy", "de menu", "que hay de comer"])) {
        if (!menuDeHoy) {
            return {
                texto: `Hoy no tengo cargado el menú del día de ${negocio.name}. ${NO_LO_SE}`,
                fuentes: [],
            };
        }
        if (menuDeHoy.is_demo) {
            return {
                texto: `El menú que aparece en la web es de muestra: ${negocio.name} todavía no ha cargado ` +
                    `el de hoy. ${NO_LO_SE}`,
                fuentes: [{ tipo: "menu_del_dia", id: menuDeHoy.id, nombre: "Menú del día (muestra)" }],
            };
        }
        const porCurso = ["primero", "segundo", "postre"]
            .map((c) => {
            const lista = menuDeHoy.platos.filter((p) => p.course === c).map((p) => p.name);
            return lista.length ? `${c === "postre" ? "Postres" : `${c}s`}: ${lista.join(", ")}` : null;
        })
            .filter(Boolean);
        const precio = menuDeHoy.price_cents !== null ? ` Son ${euros(menuDeHoy.price_cents)}.` : "";
        const bebida = menuDeHoy.includes_drink ? " Incluye bebida." : "";
        return {
            texto: `El menú de hoy es: ${porCurso.join(". ")}.${precio}${bebida}`,
            fuentes: [{ tipo: "menu_del_dia", id: menuDeHoy.id, nombre: "Menú del día" }],
            avisoAlergias: true,
        };
    }
    /* --- Alérgenos: lo más delicado. Solo lo declarado, y siempre con aviso. --- */
    const alergenoPreguntado = Object.keys(ALERGENOS_ES)
        .find((a) => contiene(q, [ALERGENOS_ES[a], a]));
    if (alergenoPreguntado || contiene(q, ["alergia", "alergeno", "alérgeno", "celiaco", "celíaco"])) {
        if (!alergenoPreguntado) {
            return { texto: `Dime qué alérgeno concreto te preocupa y te digo qué platos lo declaran. ${AVISO_ALERGIAS}`, fuentes: [], avisoAlergias: true };
        }
        const conEse = platos.filter((p) => p.alergenos.includes(alergenoPreguntado));
        const declarados = platos.filter((p) => p.alergenos.length > 0);
        if (declarados.length === 0) {
            return {
                texto: `${negocio.name} todavía no ha cargado los alérgenos de la carta, así que no puedo decírtelo. ${AVISO_ALERGIAS}`,
                fuentes: [],
                avisoAlergias: true,
            };
        }
        return {
            texto: `Estos platos declaran ${ALERGENOS_ES[alergenoPreguntado].toLowerCase()}: ` +
                `${conEse.map((p) => p.name).join(", ") || "ninguno de los que tengo cargados"}. ` +
                `Ojo: solo puedo ver lo que el negocio ha declarado, y no todos los platos lo tienen cargado. ${AVISO_ALERGIAS}`,
            fuentes: conEse.slice(0, 8).map((p) => ({ tipo: "plato", id: p.id, nombre: p.name })),
            avisoAlergias: true,
        };
    }
    /* --- Para compartir --- */
    if (contiene(q, ["compartir", "raciones", "picar", "para el centro"])) {
        const lista = platos.filter((p) => p.tags.includes("para_compartir"));
        if (lista.length === 0) {
            return { texto: `No tengo marcados platos para compartir en la carta. ${NO_LO_SE}`, fuentes: [] };
        }
        return {
            texto: `Para compartir tienes: ${lista.map((p) => `${p.name} (${euros(p.price_cents)})`).join(", ")}.`,
            fuentes: lista.slice(0, 8).map((p) => ({ tipo: "plato", id: p.id, nombre: p.name })),
        };
    }
    /* --- Vegetariano / vegano --- */
    if (contiene(q, ["vegetarian", "vegan", "sin carne"])) {
        const lista = platos.filter((p) => p.tags.includes("vegetariano") || p.tags.includes("vegano"));
        if (lista.length === 0) {
            return {
                texto: `En la carta que tengo cargada no hay platos marcados como vegetarianos o veganos. Eso no quiere decir que no los tengan: ${NO_LO_SE.toLowerCase()}`,
                fuentes: [],
            };
        }
        return {
            texto: `Marcados como vegetarianos o veganos: ${lista.map((p) => p.name).join(", ")}.`,
            fuentes: lista.map((p) => ({ tipo: "plato", id: p.id, nombre: p.name })),
            avisoAlergias: true,
        };
    }
    /* --- Reservas y grupos --- */
    if (contiene(q, ["reservar", "reserva", "mesa para", "somos", "personas"])) {
        const puede = ajustes.modules?.reservations;
        return {
            texto: puede
                ? `Puedes pedir mesa desde la propia web, en el botón de reservar. La reserva no queda confirmada hasta que ${negocio.name} te responde. Para grupos grandes, mejor cuéntalo en el apartado de grupos o llama.`
                : `Para reservar, lo mejor es llamar al local. ${NO_LO_SE}`,
            fuentes: [{ tipo: "ajustes", nombre: "Configuración de reservas" }],
        };
    }
    /* --- Horario --- */
    if (contiene(q, ["horario", "abierto", "cerrado", "a que hora", "abris", "cierran"])) {
        const horario = horarioLegible(ajustes.opening_hours ?? []);
        if (horario.length === 0) {
            return {
                texto: `El horario de ${negocio.name} todavía no está confirmado en la web. ${NO_LO_SE}`,
                fuentes: [],
            };
        }
        return { texto: horario.join(". "), fuentes: [{ tipo: "ajustes", nombre: "Horario" }] };
    }
    /* --- Menús especiales --- */
    if (contiene(q, ["especial", "fin de semana", "navidad", "celebracion", "jornada"])) {
        const lista = especialesVigentes(espacio);
        if (lista.length === 0) {
            return { texto: `Ahora mismo no hay menús especiales publicados. ${NO_LO_SE}`, fuentes: [] };
        }
        return {
            texto: lista
                .map((m) => `${m.name}${m.price_cents !== null ? ` (${euros(m.price_cents)})` : ""}`)
                .join(". "),
            fuentes: lista.map((m) => ({ tipo: "menu_especial", id: m.id, nombre: m.name })),
        };
    }
    /* --- Búsqueda de un plato concreto --- */
    const encontrados = platos.filter((p) => contiene(q, [p.name]));
    if (encontrados.length > 0) {
        return {
            texto: encontrados
                .map((p) => `${p.name}: ${euros(p.price_cents, { desde: p.price_from })}${p.description ? `. ${p.description}` : ""}${p.is_demo ? " (precio sin confirmar por el negocio)" : ""}`)
                .join(". "),
            fuentes: encontrados.map((p) => ({ tipo: "plato", id: p.id, nombre: p.name })),
        };
    }
    return {
        texto: `Eso no lo tengo publicado, así que no me lo invento. ${NO_LO_SE}`,
        fuentes: [],
    };
}
