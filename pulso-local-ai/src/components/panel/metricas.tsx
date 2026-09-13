import { Icono, type NombreIcono } from "@/components/ui/icono";
import { numero } from "@/lib/formato";

export function TarjetaMetrica({
  titulo,
  valor,
  detalle,
  icono,
  tono = "neutro",
}: {
  titulo: string;
  valor: number | string | null;
  detalle?: string;
  icono?: NombreIcono;
  tono?: "neutro" | "bueno" | "atencion";
}) {
  const color =
    tono === "bueno" ? "text-[var(--exito)]" : tono === "atencion" ? "text-[var(--aviso)]" : "text-[var(--marca)]";

  return (
    <div className="rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-[var(--texto-suave)]">{titulo}</p>
        {icono ? <Icono nombre={icono} className={`size-4 ${color}`} /> : null}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${color}`}>
        {typeof valor === "number" ? numero(valor) : (valor ?? "—")}
      </p>
      {detalle ? <p className="mt-1 text-xs text-[var(--texto-suave)]">{detalle}</p> : null}
    </div>
  );
}
