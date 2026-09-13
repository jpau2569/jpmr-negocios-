"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crearNegocioDemo } from "@/app/admin/acciones";

export function FormularioNuevoNegocio({
  plantillas,
  negocios,
}: {
  plantillas: { slug: string; name: string }[];
  negocios: { id: string; name: string }[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva demo de 7 días</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={(datos) =>
            iniciar(async () => {
              const r = await crearNegocioDemo(datos);
              setMensaje(
                r.error
                  ? { tono: "peligro", texto: r.error }
                  : { tono: "exito", texto: `Creado en /b/${r.slug}` },
              );
            })
          }
          className="space-y-4"
        >
          <Campo etiqueta="Nombre del negocio" obligatorio>
            <Input name="name" required maxLength={120} placeholder="Inmobiliaria Ejemplo" />
          </Campo>

          <Campo etiqueta="Dirección web" ayuda="Si lo dejas vacío se genera del nombre.">
            <Input name="slug" maxLength={80} placeholder="inmobiliaria-ejemplo" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Teléfono">
              <Input name="phone" maxLength={30} />
            </Campo>
            <Campo etiqueta="WhatsApp">
              <Input name="whatsapp_phone" maxLength={30} />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Ciudad">
              <Input name="city" maxLength={80} />
            </Campo>
            <Campo etiqueta="Días de demo">
              <Input name="dias_demo" type="number" min={1} max={90} defaultValue={7} />
            </Campo>
          </div>

          <Campo etiqueta="Plantilla del vertical">
            <Select name="plantilla" defaultValue="inmobiliaria-asesoria-local">
              {plantillas.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            etiqueta="Copiar servicios y FAQs de"
            ayuda="Copia solo contenido editorial. Nunca se copian contactos, opiniones ni analítica."
          >
            <Select name="copiar_de" defaultValue="">
              <option value="">No copiar nada</option>
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </Campo>

          {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

          <Button type="submit" ancho="completo" disabled={pendiente}>
            {pendiente ? "Creando…" : "Crear demo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
