// ============================================================================
//  Módulo "¿CÓMO FUNCIONA?" — el tour que vende la demo sola
// ----------------------------------------------------------------------------
//  Una demo enseñada en persona se explica sola porque estás delante. Una demo
//  MANDADA por WhatsApp, no: el dueño del bar la abre, ve una web bonita y no
//  entiende qué gana él. Este módulo es esa explicación, paso a paso, con el
//  lenguaje del negocio (no del software) y con un botón para probar cada cosa
//  de verdad en el momento.
//
//  Solo se carga cuando la web está en modo comercial (modulos.pedirDemo). En
//  el sitio real de un cliente no pinta nada: sus clientes vienen a comer o a
//  ver pisos, no a que les vendan una web.
// ============================================================================

import { crear, vaciar, abrirModal, cerrarModal, euros, icono } from "../js/ui.js";

export const meta = {
  id: "tour",
  nombre: "¿Cómo funciona?",
  modulo: "pedirDemo",
  sector: "todos",
};

// Los pasos se escriben en términos de lo que el negocio GANA, no de lo que la
// web tiene. "Dejas de coger el teléfono" vende; "módulo de reservas", no.
const PASOS = {
  restaurante: [
    { clave: "carta", titulo: "Tu carta, sin PDF y sin pellizcar la pantalla",
      texto: "Lo que giras arriba son tus platos. Se ven grandes, con su foto y su precio, y se pasan con el dedo. Nada de un PDF de 3 MB que el cliente cierra antes de leerlo.",
      ver: "carta" },
    { clave: "pedidos", titulo: "Te piden sin llamarte",
      texto: "El cliente monta su pedido, elige si lo recoge o se lo llevas, y te llega escrito: qué quiere, cuánto es, su teléfono y su dirección. Se acabó apuntar en un papel con la cocina llena.",
      ver: "pedidos" },
    { clave: "reservas", titulo: "Reservan a las once de la noche",
      texto: "La gente decide dónde cena cuando tú ya cerraste. Aquí reservan solos, con tus turnos y tus días de cierre, y a ti te llega la mesa apuntada.",
      ver: "reservas" },
    { clave: "qr", titulo: "Un QR en cada mesa",
      texto: "Imprimes la hoja, pegas un QR en cada mesa y el cliente ve la carta en su móvil, con la mesa ya identificada. Si quieres, pide desde ahí sin levantar la mano.",
      ver: "qr" },
  ],
  inmobiliaria: [
    { clave: "inmuebles", titulo: "Tu cartera entera, girando",
      texto: "Esos son tus pisos, con su precio, sus metros y sus fotos. Se pasan con el dedo, se filtran por zona y por operación, y se ven igual de bien en el móvil que en la tele del escaparate.",
      ver: "inmuebles" },
    { clave: "marcar", titulo: "El cliente marca lo que le gusta",
      texto: "En vez de mandarte quince mensajes, va marcando los que le interesan mientras mira. Tú luego sabes exactamente qué le entra por el ojo.",
      ver: "inmuebles" },
    { clave: "visita", titulo: "Y te pide visita SOLO de esos",
      texto: "Un botón y te llega el mensaje con los pisos que marcó, su nombre, su teléfono y cuándo puede. Eso es una visita, no un «hola, buenas, ¿qué tenéis?».",
      ver: "inmuebles" },
    { clave: "valoracion", titulo: "Y los propietarios se presentan solos",
      texto: "El que quiere vender pide su valoración desde aquí y te deja la zona, los metros y su teléfono. Captación entrando mientras tú duermes.",
      ver: "valoracion" },
  ],
};

const COMUNES = [
  { clave: "marca", titulo: "Con tu marca, no con la mía",
    texto: "Tus colores, tu logo, tu teléfono y tus redes. Lo que estás viendo no es una plantilla con tu nombre encima: la web se pinta entera con lo tuyo, hasta las luces del 3D." },
  { clave: "movil", titulo: "Hecha para el móvil del cliente",
    texto: "Nueve de cada diez la van a abrir en el móvil, andando por la calle. Por eso se toca con el dedo, carga rápida y, si el teléfono es viejo y no puede con el 3D, enseña lo mismo en lista sin que se note." },
];

export function crearModulo(ctx) {
  const { config } = ctx;
  const comercial = config.comercial || {};
  let paso = 0;

  // Solo se explican las cosas que este negocio tiene encendidas: prometer lo
  // que no está contratado es la mejor forma de quedar mal en la segunda visita.
  function pasos() {
    const delSector = (PASOS[config.sector] || []).filter((p) => {
      if (p.clave === "pedidos") return config.modulos.pedidosDomicilio;
      if (p.clave === "reservas") return config.modulos.reservas;
      if (p.clave === "qr") return config.modulos.qrMesas;
      if (p.clave === "valoracion") return config.modulos.valoracionGratis;
      return true;
    });
    return [...delSector, ...COMUNES, { clave: "precio", titulo: "¿Y esto qué cuesta?", final: true }];
  }

  function pintarPrecio() {
    const precio = comercial.precio
      ? euros(comercial.precio)
      : "lo hablamos";
    return crear("div", { clase: "formulario" }, [
      comercial.demoGratis
        ? crear("p", { html: `<strong>La demo con tu negocio dentro es gratis.</strong> Te la monto con lo que ya tengas publicado y la ves antes de decidir nada.` })
        : null,
      crear("p", { html: `Si te gusta y la quieres de verdad —con tus fotos, tus precios y todo funcionando— son <strong style="font-size:1.4rem;color:var(--color-acento)">${precio}</strong>.` }),
      (comercial.incluye || []).length
        ? crear("ul", { clase: "lista-lineas" }, comercial.incluye.map((linea) => crear("li", {}, [
            crear("span", { texto: "✅" }), crear("span", { clase: "crece", texto: linea }),
          ])))
        : null,
      crear("div", { clase: "botonera" }, [
        crear("button", {
          clase: "boton principal", type: "button", texto: "Quiero la mía",
          onclick: () => { cerrarModal(); ctx.abrirModulo("demo"); },
        }),
        crear("button", {
          clase: "boton", type: "button", texto: "Mandársela a alguien",
          onclick: () => { cerrarModal(); modulos().get("demo")?.compartir?.(); },
        }),
      ]),
    ]);
  }

  const modulos = () => ctx.modulos || new Map();

  function pintar() {
    const lista = pasos();
    const actual = lista[paso];
    const cuerpo = crear("div", {}, [
      crear("p", { clase: "pequeno tenue", texto: `Paso ${paso + 1} de ${lista.length}` }),
      crear("div", { clase: "barra" }, [
        crear("div", { clase: "barra-relleno", style: `width:${((paso + 1) / lista.length) * 100}%` }),
      ]),
      crear("h3", { texto: actual.titulo, style: "margin-top:1rem" }),
      actual.final ? pintarPrecio() : crear("p", { texto: actual.texto }),
      crear("div", { clase: "botonera", style: "margin-top:1rem" }, [
        paso > 0 ? crear("button", { clase: "boton plano", type: "button", texto: "‹ Atrás", onclick: () => { paso--; pintar(); } }) : null,
        actual.ver
          ? crear("button", {
              clase: "boton", type: "button", texto: "Probarlo ahora",
              onclick: () => { cerrarModal(); ctx.abrirModulo(actual.ver); },
            })
          : null,
        paso < lista.length - 1
          ? crear("button", { clase: "boton principal", type: "button", texto: "Siguiente ›", onclick: () => { paso++; pintar(); } })
          : null,
      ]),
    ]);
    abrirModal("Cómo funciona esto", cuerpo);
  }

  function abrir(desdeCero = true) {
    if (desdeCero) paso = 0;
    pintar();
  }

  // Bloque fijo en la página: quien llega por un enlace mandado por WhatsApp
  // no sabe qué está viendo, y el botón de arriba se le pasa.
  function montarSeccion(nodo) {
    nodo.append(
      crear("h2", { texto: "¿Qué es esto que estoy viendo?" }),
      crear("p", { clase: "tenue", style: "max-width:60ch",
        texto: `Una web de verdad para ${config.sector === "restaurante" ? "un restaurante" : "una inmobiliaria"}, funcionando. No es un vídeo ni un dibujo: puedes tocarlo todo. En dos minutos te cuento qué gana el negocio con cada cosa.` }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "button", html: `${icono("web")}<span>Explícamelo en 2 minutos</span>`, onclick: () => abrir(true) }),
      ])
    );
  }

  return { meta, abrir, montarSeccion, tituloSeccion: null };
}
