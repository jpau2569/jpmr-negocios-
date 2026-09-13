"use client";

import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/ui/icono";
import { Button } from "@/components/ui/button";
import { idSesion, registrar } from "@/lib/cliente/eventos";

interface Mensaje {
  de: "persona" | "asistente";
  texto: string;
  derivado?: boolean;
}

/**
 * Botón flotante «Pregunta a …».
 *
 * El asistente solo repite información aprobada por el negocio. Cuando no la
 * encuentra, o cuando la pregunta entra en terreno legal, fiscal, laboral o
 * financiero, deriva a una persona en vez de improvisar. Ese aviso está siempre
 * visible en la cabecera del chat, no en letra pequeña.
 */
export function AsistenteFlotante({
  slug,
  nombreAsistente,
  negocio,
}: {
  slug: string;
  nombreAsistente: string;
  negocio: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      de: "asistente",
      texto: `Hola. Puedo ayudarte con horarios, contacto, servicios, cómo pedir una visita y cómo funciona la valoración de ${negocio}. Para temas legales, fiscales o laborales te paso con una persona.`,
    },
  ]);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const texto = pregunta.trim();
    if (!texto || enviando) return;

    setMensajes((previos) => [...previos, { de: "persona", texto }]);
    setPregunta("");
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/publico/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessSlug: slug, pregunta: texto, sessionId: idSesion() }),
      });
      const datos = (await respuesta.json()) as { respuesta?: string; derivado?: boolean; error?: string };
      setMensajes((previos) => [
        ...previos,
        {
          de: "asistente",
          texto: datos.respuesta ?? datos.error ?? "Ahora mismo no puedo responder. Inténtalo en un momento.",
          derivado: datos.derivado,
        },
      ]);
    } catch {
      setMensajes((previos) => [
        ...previos,
        { de: "asistente", texto: "No he podido conectar. Prueba otra vez en un momento." },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          void registrar(slug, "ai_chat_open");
        }}
        className="fixed right-4 bottom-24 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[var(--marca)] px-4 py-3 text-sm font-semibold text-[var(--marca-contraste)] shadow-lg sm:bottom-6"
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <Icono nombre="chat" className="size-5" />
        Pregunta a {negocio.split(" ").slice(-1)[0]}
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-label={`Asistente ${nombreAsistente}`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={(e) => e.target === e.currentTarget && setAbierto(false)}
        >
          <div className="animar-entrada flex h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-[var(--superficie)] sm:h-[620px] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--borde)] p-4">
              <div>
                <p className="font-semibold">{nombreAsistente}</p>
                <p className="text-xs text-[var(--texto-suave)]">
                  Responde solo con información aprobada por {negocio}. No sustituye a un profesional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar el asistente"
                className="rounded-lg p-2 hover:bg-[var(--superficie-2)]"
              >
                <Icono nombre="cerrar" className="size-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {mensajes.map((mensaje, i) => (
                <div
                  key={i}
                  className={
                    mensaje.de === "persona"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--marca)] px-3 py-2 text-sm text-[var(--marca-contraste)]"
                      : "mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-[var(--superficie-2)] px-3 py-2 text-sm"
                  }
                >
                  {mensaje.texto}
                </div>
              ))}
              {enviando ? <p className="text-xs text-[var(--texto-suave)]">Buscando en la información aprobada…</p> : null}
              <div ref={finRef} />
            </div>

            <form onSubmit={enviar} className="flex gap-2 border-t border-[var(--borde)] p-3 seguro-abajo">
              <label className="sr-only" htmlFor="pregunta-asistente">
                Tu pregunta
              </label>
              <input
                id="pregunta-asistente"
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder="¿Cómo pido una visita?"
                maxLength={400}
                className="min-h-11 flex-1 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-base"
              />
              <Button type="submit" disabled={enviando || !pregunta.trim()} size="icono" aria-label="Enviar pregunta">
                <Icono nombre="flecha" />
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
