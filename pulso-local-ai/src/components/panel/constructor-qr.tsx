"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Badge } from "@/components/ui/badge";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { alternarQr, archivarQr, crearQr } from "@/app/dashboard/qr/acciones";
import { cartelSvg, qrSvg, validarContrasteQr, type FormatoCartel } from "@/lib/qr";
import { registrar } from "@/lib/cliente/eventos";
import { ETIQUETA_DESTINO_QR } from "@/lib/etiquetas";
import type { CodigoQr, DestinoQr } from "@/types/dominio";

type CodigoConMetricas = CodigoQr & { metricas: { escaneos: number; leads: number } };

const DESTINOS: DestinoQr[] = [
  "landing", "inmueble", "valoracion", "buscar_vivienda", "servicios",
  "administracion_fincas", "opinion", "whatsapp", "url_personalizada",
];

const FORMATOS: { valor: FormatoCartel; etiqueta: string; nota: string }[] = [
  { valor: "A4", etiqueta: "Cartel A4", nota: "Para la vivienda o el tablón" },
  { valor: "A5", etiqueta: "Cartel A5", nota: "Para el mostrador" },
  { valor: "escaparate", etiqueta: "Escaparate", nota: "Cuadrado, se lee desde la calle" },
  { valor: "tarjeta", etiqueta: "Tarjeta de visita", nota: "85 × 55 mm" },
];

/** Descarga un texto como fichero, sin pasar por el servidor. */
function descargarTexto(contenido: string, nombre: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Convierte el SVG del QR en PNG usando un canvas del propio navegador.
 *
 * Sin librerías y sin servidor: el SVG se dibuja en un canvas a 1024 px, que es
 * tamaño de sobra para imprimir un cartel A4 sin que se vean los bordes
 * dentados.
 */
async function svgAPng(svg: string, lado = 1024): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const imagen = new Image();
    imagen.width = lado;
    imagen.height = lado;
    await new Promise<void>((resolver, rechazar) => {
      imagen.onload = () => resolver();
      imagen.onerror = () => rechazar(new Error("No se ha podido convertir el QR"));
      imagen.src = url;
    });

    const lienzo = document.createElement("canvas");
    lienzo.width = lado;
    lienzo.height = lado;
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("El navegador no permite generar el PNG");
    contexto.imageSmoothingEnabled = false;
    contexto.drawImage(imagen, 0, 0, lado, lado);

    return await new Promise<Blob>((resolver, rechazar) =>
      lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error("PNG vacío"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ConstructorQr({
  urlBase,
  negocio,
  codigos,
  inmuebles,
}: {
  urlBase: string;
  negocio: { id: string; name: string; slug: string };
  codigos: CodigoConMetricas[];
  inmuebles: { id: string; title: string }[];
}) {
  const [destino, setDestino] = useState<DestinoQr>("landing");
  const [colorQr, setColorQr] = useState("#0E2A3F");
  const [colorFondo, setColorFondo] = useState("#FFFFFF");
  const [seleccionado, setSeleccionado] = useState<CodigoConMetricas | null>(codigos[0] ?? null);
  const [formato, setFormato] = useState<FormatoCartel>("A4");
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null);

  const contrasteNuevo = useMemo(() => validarContrasteQr(colorQr, colorFondo), [colorQr, colorFondo]);

  const urlSeleccionado = seleccionado ? `${urlBase}/q/${seleccionado.code}` : "";
  const svgSeleccionado = useMemo(
    () =>
      seleccionado
        ? qrSvg(urlSeleccionado, {
            colorOscuro: seleccionado.fg_color,
            colorClaro: seleccionado.bg_color,
            nivel: "Q",
          })
        : "",
    [seleccionado, urlSeleccionado],
  );

  const svgCartel = useMemo(() => {
    if (!seleccionado) return "";
    const titulos: Partial<Record<DestinoQr, string>> = {
      landing: "Escanea y descubre lo que podemos hacer por ti",
      valoracion: "¿Cuánto vale tu casa?",
      inmueble: "¿Te interesa esta vivienda?",
      opinion: "¿Cómo ha ido? Cuéntanoslo",
      buscar_vivienda: "¿Buscas vivienda?",
      administracion_fincas: "¿Buscáis administrador de fincas?",
      servicios: "Asesoría fiscal, laboral y jurídica",
      whatsapp: "Escríbenos por WhatsApp",
    };
    return cartelSvg({
      titulo: titulos[seleccionado.target_type] ?? seleccionado.label,
      subtitulo: "Apunta con la cámara del móvil",
      negocio: negocio.name,
      pie: seleccionado.location_note ?? undefined,
      url: urlSeleccionado,
      formato,
      colorMarca: seleccionado.fg_color,
    });
  }, [seleccionado, formato, negocio.name, urlSeleccionado]);

  function imprimir(svg: string) {
    const ventana = window.open("", "_blank", "width=900,height=1200");
    if (!ventana) {
      setMensaje({ tono: "peligro", texto: "El navegador ha bloqueado la ventana de impresión." });
      return;
    }
    ventana.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cartel</title>` +
        `<style>@page{margin:0}body{margin:0;display:flex;justify-content:center}</style></head>` +
        `<body>${svg}<script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    ventana.document.close();
    void registrar(negocio.slug, "qr_print_preview");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Crear un código QR</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(datos) =>
              iniciar(async () => {
                const r = await crearQr(datos);
                setMensaje(
                  r.error ? { tono: "peligro", texto: r.error } : { tono: "exito", texto: `Creado: /q/${r.code}` },
                );
              })
            }
            className="space-y-4"
          >
            <Campo etiqueta="Nombre interno" obligatorio ayuda="Para reconocerlo en la lista: «Escaparate», «Piso DEMO-001»…">
              <Input name="label" required maxLength={80} />
            </Campo>

            <Campo etiqueta="¿A dónde lleva?" obligatorio>
              <Select name="target_type" value={destino} onChange={(e) => setDestino(e.target.value as DestinoQr)}>
                {DESTINOS.map((d) => (
                  <option key={d} value={d}>
                    {ETIQUETA_DESTINO_QR[d]}
                  </option>
                ))}
              </Select>
            </Campo>

            {destino === "inmueble" ? (
              <Campo etiqueta="Inmueble" obligatorio>
                <Select name="property_id" required>
                  <option value="">Elige un inmueble</option>
                  {inmuebles.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </Select>
              </Campo>
            ) : null}

            {destino === "whatsapp" ? (
              <Campo etiqueta="Mensaje previo del cliente" ayuda="Aparecerá escrito en su WhatsApp, listo para enviar.">
                <Textarea name="whatsapp_message" rows={2} maxLength={300} defaultValue="Hola, os escribo desde el cartel." />
              </Campo>
            ) : null}

            {destino === "url_personalizada" ? (
              <Campo etiqueta="URL de destino" obligatorio>
                <Input name="target_url" type="url" placeholder="https://…" required />
              </Campo>
            ) : null}

            <Campo etiqueta="Dónde va a estar" ayuda="El escaparate, el balcón del piso, el mostrador…">
              <Input name="location_note" maxLength={120} />
            </Campo>

            <Campo etiqueta="Campaña (UTM)">
              <Input name="utm_campaign" maxLength={60} placeholder="captacion-otono" />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Color del código">
                <input
                  type="color"
                  name="fg_color"
                  value={colorQr}
                  onChange={(e) => setColorQr(e.target.value)}
                  className="h-11 w-full rounded-[var(--radio)] border border-[var(--borde)]"
                />
              </Campo>
              <Campo etiqueta="Fondo">
                <input
                  type="color"
                  name="bg_color"
                  value={colorFondo}
                  onChange={(e) => setColorFondo(e.target.value)}
                  className="h-11 w-full rounded-[var(--radio)] border border-[var(--borde)]"
                />
              </Campo>
            </div>

            <div className="flex items-center gap-3 rounded-[var(--radio)] bg-[var(--superficie-2)] p-3">
              <span
                className="size-14 shrink-0 rounded"
                dangerouslySetInnerHTML={{
                  __html: qrSvg("https://ejemplo.test/q/vista-previa", {
                    colorOscuro: colorQr,
                    colorClaro: colorFondo,
                    nivel: "M",
                  }),
                }}
              />
              <p className="text-xs text-[var(--texto-suave)]">
                Contraste {contrasteNuevo.ratio.toFixed(1)}:1.{" "}
                {contrasteNuevo.aviso ?? "Se lee bien en cualquier condición de luz."}
              </p>
            </div>

            {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

            <Button type="submit" ancho="completo" disabled={pendiente || !contrasteNuevo.valido}>
              {pendiente ? "Creando…" : "Crear QR"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {seleccionado ? (
          <Card>
            <CardHeader>
              <CardTitle>{seleccionado.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start gap-5">
                <span
                  className="size-40 shrink-0"
                  aria-label={`Código QR de ${seleccionado.label}`}
                  dangerouslySetInnerHTML={{ __html: svgSeleccionado }}
                />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p className="break-all">
                    <code className="rounded bg-[var(--superficie-2)] px-1.5 py-0.5">{urlSeleccionado}</code>
                  </p>
                  <p className="text-[var(--texto-suave)]">
                    {ETIQUETA_DESTINO_QR[seleccionado.target_type]}
                    {seleccionado.location_note ? ` · ${seleccionado.location_note}` : ""}
                  </p>
                  <p>
                    <strong>{seleccionado.metricas.escaneos}</strong> escaneos y{" "}
                    <strong>{seleccionado.metricas.leads}</strong> contactos en 30 días.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="contorno"
                      onClick={() => {
                        descargarTexto(svgSeleccionado, `qr-${seleccionado.code}.svg`, "image/svg+xml");
                        void registrar(negocio.slug, "qr_download");
                      }}
                    >
                      Descargar SVG
                    </Button>
                    <Button
                      size="sm"
                      variant="contorno"
                      onClick={async () => {
                        try {
                          const png = await svgAPng(svgSeleccionado);
                          const url = URL.createObjectURL(png);
                          const enlace = document.createElement("a");
                          enlace.href = url;
                          enlace.download = `qr-${seleccionado.code}.png`;
                          enlace.click();
                          URL.revokeObjectURL(url);
                          void registrar(negocio.slug, "qr_download");
                        } catch {
                          setMensaje({ tono: "peligro", texto: "No se ha podido generar el PNG en este navegador." });
                        }
                      }}
                    >
                      Descargar PNG
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-[var(--borde)] pt-4">
                <p className="text-sm font-semibold">Cartel imprimible</p>
                <div className="flex flex-wrap gap-2">
                  {FORMATOS.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      onClick={() => setFormato(f.valor)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        formato === f.valor
                          ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                          : "border-[var(--borde)]"
                      }`}
                      title={f.nota}
                    >
                      {f.etiqueta}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-start gap-4">
                  <div
                    className="w-48 overflow-hidden rounded border border-[var(--borde)] [&>svg]:h-auto [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: svgCartel }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => imprimir(svgCartel)}>
                      Imprimir cartel
                    </Button>
                    <Button
                      size="sm"
                      variant="contorno"
                      onClick={() => descargarTexto(svgCartel, `cartel-${seleccionado.code}-${formato}.svg`, "image/svg+xml")}
                    >
                      Descargar cartel SVG
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Tus códigos ({codigos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {codigos.length ? (
              codigos.map((codigo) => (
                <div
                  key={codigo.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radio)] border p-3 ${
                    seleccionado?.id === codigo.id ? "border-[var(--marca)]" : "border-[var(--borde)]"
                  }`}
                >
                  <button type="button" className="min-w-0 text-left" onClick={() => setSeleccionado(codigo)}>
                    <p className="text-sm font-semibold">{codigo.label}</p>
                    <p className="text-xs text-[var(--texto-suave)]">
                      /q/{codigo.code} · {ETIQUETA_DESTINO_QR[codigo.target_type]} · {codigo.metricas.escaneos}{" "}
                      escaneos
                    </p>
                  </button>

                  <div className="flex items-center gap-3">
                    <Badge tono={codigo.is_active ? "exito" : "neutro"}>
                      {codigo.is_active ? "Activo" : "Pausado"}
                    </Badge>
                    <button
                      type="button"
                      className="text-xs underline"
                      disabled={pendiente}
                      onClick={() => iniciar(async () => void (await alternarQr(codigo.id, !codigo.is_active)))}
                    >
                      {codigo.is_active ? "Pausar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[var(--texto-suave)] underline"
                      disabled={pendiente}
                      onClick={() => iniciar(async () => void (await archivarQr(codigo.id)))}
                    >
                      Archivar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--texto-suave)]">
                Todavía no hay códigos. Empieza por el del escaparate y el de valoración.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
