"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { guardarInmueble } from "@/app/dashboard/inmuebles/acciones";
import { ETIQUETA_ESTADO_INMUEBLE, ETIQUETA_OPERACION, ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";
import { TIPOS_INMUEBLE } from "@/lib/validaciones/formularios";

export interface ValoresInmueble {
  id?: string;
  title?: string;
  slug?: string;
  reference_code?: string | null;
  operation_type?: string;
  property_type?: string;
  status?: string;
  price?: number | null;
  municipality?: string | null;
  neighborhood?: string | null;
  public_address?: string | null;
  private_address?: string | null;
  show_public_address?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  built_area_m2?: number | null;
  usable_area_m2?: number | null;
  floor?: string | null;
  has_elevator?: boolean | null;
  has_terrace?: boolean | null;
  has_garage?: boolean | null;
  energy_rating?: string | null;
  year_built?: number | null;
  short_description?: string | null;
  description?: string | null;
  conditions_note?: string | null;
  tags?: string[];
  featured?: boolean;
}

const OPERACIONES = ["venta", "alquiler", "alquiler_opcion_compra", "traspaso"] as const;
const ESTADOS = ["borrador", "disponible", "reservado", "vendido", "alquilado"] as const;
const ENERGIA = ["", "A", "B", "C", "D", "E", "F", "G", "en_tramite", "exento"] as const;

export function FormularioInmueble({ valores }: { valores: ValoresInmueble }) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null);

  return (
    <form
      action={(datos) =>
        iniciar(async () => {
          const r = await guardarInmueble(valores.id ?? null, datos);
          setMensaje(
            r?.error
              ? { tono: "peligro", texto: r.error }
              : { tono: "exito", texto: "Inmueble guardado" },
          );
        })
      }
      className="space-y-6"
    >
      <section className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Datos básicos</h2>

        <Campo etiqueta="Título" obligatorio ayuda="Es lo primero que se lee en el catálogo.">
          <Input name="title" defaultValue={valores.title ?? ""} required maxLength={160} />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Referencia interna">
            <Input name="reference_code" defaultValue={valores.reference_code ?? ""} maxLength={40} />
          </Campo>
          <Campo etiqueta="URL (slug)" ayuda="Si lo dejas vacío se genera a partir del título.">
            <Input name="slug" defaultValue={valores.slug ?? ""} maxLength={80} />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Operación">
            <Select name="operation_type" defaultValue={valores.operation_type ?? "venta"}>
              {OPERACIONES.map((o) => (
                <option key={o} value={o}>
                  {ETIQUETA_OPERACION[o]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Tipo">
            <Select name="property_type" defaultValue={valores.property_type ?? "piso"}>
              {TIPOS_INMUEBLE.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_INMUEBLE[t]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo etiqueta="Estado">
            <Select name="status" defaultValue={valores.status ?? "borrador"}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_INMUEBLE[e]}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Precio (€)" ayuda="En alquiler, la renta mensual.">
            <Input name="price" type="number" step="1" min="0" defaultValue={valores.price ?? ""} />
          </Campo>
          <Campo etiqueta="Etiquetas" ayuda="Separadas por comas: nuevo, destacado, oportunidad…">
            <Input name="tags" defaultValue={(valores.tags ?? []).join(", ")} maxLength={200} />
          </Campo>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="featured" defaultChecked={valores.featured} className="size-5 accent-[var(--marca)]" />
          Destacar en la portada
        </label>
      </section>

      <section className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Ubicación</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Municipio">
            <Input name="municipality" defaultValue={valores.municipality ?? ""} maxLength={80} />
          </Campo>
          <Campo etiqueta="Zona o barrio">
            <Input name="neighborhood" defaultValue={valores.neighborhood ?? ""} maxLength={80} />
          </Campo>
        </div>

        <Campo etiqueta="Dirección interna" ayuda="Uso interno del equipo. Nunca se publica.">
          <Input name="private_address" defaultValue={valores.private_address ?? ""} maxLength={200} />
        </Campo>

        <Campo etiqueta="Dirección pública aproximada">
          <Input name="public_address" defaultValue={valores.public_address ?? ""} maxLength={160} />
        </Campo>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="show_public_address"
            defaultChecked={valores.show_public_address}
            className="mt-0.5 size-5 accent-[var(--marca)]"
          />
          <span>
            Mostrar la dirección pública en la ficha
            <span className="block text-xs text-[var(--texto-suave)]">
              Piénsalo dos veces si la vivienda está habitada: publicar el portal exacto es un riesgo para quien
              vive dentro.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Características</h2>

        <div className="grid gap-4 sm:grid-cols-4">
          <Campo etiqueta="Habitaciones">
            <Input name="bedrooms" type="number" min="0" defaultValue={valores.bedrooms ?? ""} />
          </Campo>
          <Campo etiqueta="Baños">
            <Input name="bathrooms" type="number" min="0" defaultValue={valores.bathrooms ?? ""} />
          </Campo>
          <Campo etiqueta="M² construidos">
            <Input name="built_area_m2" type="number" min="0" defaultValue={valores.built_area_m2 ?? ""} />
          </Campo>
          <Campo etiqueta="M² útiles">
            <Input name="usable_area_m2" type="number" min="0" defaultValue={valores.usable_area_m2 ?? ""} />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Planta">
            <Input name="floor" defaultValue={valores.floor ?? ""} maxLength={20} />
          </Campo>
          <Campo etiqueta="Año de construcción">
            <Input name="year_built" type="number" min="1800" max="2100" defaultValue={valores.year_built ?? ""} />
          </Campo>
          <Campo etiqueta="Eficiencia energética">
            <Select name="energy_rating" defaultValue={valores.energy_rating ?? ""}>
              {ENERGIA.map((e) => (
                <option key={e} value={e}>
                  {e === "" ? "Sin indicar" : e === "en_tramite" ? "En trámite" : e === "exento" ? "Exento" : e}
                </option>
              ))}
            </Select>
          </Campo>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { campo: "has_elevator", etiqueta: "Ascensor", valor: valores.has_elevator },
            { campo: "has_terrace", etiqueta: "Terraza", valor: valores.has_terrace },
            { campo: "has_garage", etiqueta: "Garaje", valor: valores.has_garage },
          ].map((extra) => (
            <label key={extra.campo} className="flex items-center gap-2">
              <input
                type="checkbox"
                name={extra.campo}
                defaultChecked={Boolean(extra.valor)}
                className="size-5 accent-[var(--marca)]"
              />
              {extra.etiqueta}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Textos</h2>

        <Campo etiqueta="Resumen corto" ayuda="Una frase para el catálogo.">
          <Input name="short_description" defaultValue={valores.short_description ?? ""} maxLength={300} />
        </Campo>

        <Campo etiqueta="Descripción">
          <Textarea name="description" rows={7} defaultValue={valores.description ?? ""} maxLength={4000} />
        </Campo>

        <Campo etiqueta="Condiciones y observaciones">
          <Textarea name="conditions_note" rows={3} defaultValue={valores.conditions_note ?? ""} maxLength={500} />
        </Campo>
      </section>

      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

      <div className="sticky bottom-4 flex gap-2">
        <Button type="submit" size="lg" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar inmueble"}
        </Button>
      </div>
    </form>
  );
}
