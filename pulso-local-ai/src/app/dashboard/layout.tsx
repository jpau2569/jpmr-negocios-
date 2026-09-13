import Link from "next/link";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { salir } from "@/app/login/acciones";
import { Icono, type NombreIcono } from "@/components/ui/icono";
import { Badge } from "@/components/ui/badge";
import { diasHasta } from "@/lib/formato";

export const dynamic = "force-dynamic";

const SECCIONES: { href: string; texto: string; icono: NombreIcono }[] = [
  { href: "/dashboard", texto: "Resumen", icono: "grafico" },
  { href: "/dashboard/inmuebles", texto: "Inmuebles", icono: "casa" },
  { href: "/dashboard/leads", texto: "Contactos", icono: "usuarios" },
  { href: "/dashboard/visitas", texto: "Visitas", icono: "calendario" },
  { href: "/dashboard/feedback", texto: "Opiniones", icono: "estrella" },
  { href: "/dashboard/qr", texto: "QR", icono: "qr" },
  { href: "/dashboard/analitica", texto: "Analítica", icono: "grafico" },
  { href: "/dashboard/configuracion", texto: "Configuración", icono: "ajustes" },
];

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const sesion = await requerirSesionPanel();
  const dias = sesion.negocio.status === "trial" ? diasHasta(sesion.negocio.trial_ends_at) : null;

  return (
    <div className="min-h-dvh bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-bold tracking-widest text-[var(--marca)] uppercase">
              Pulso Local
            </Link>
            <span className="text-sm text-[var(--texto-suave)]">{sesion.negocio.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Aviso privado de la demo. El cliente que escanea el QR no lo ve. */}
            {dias !== null ? (
              <Badge tono={dias <= 2 ? "peligro" : "aviso"}>
                {dias > 0 ? `Demo activa: quedan ${dias} ${dias === 1 ? "día" : "días"}` : "Demo caducada"}
              </Badge>
            ) : null}
            {sesion.esSuperadmin ? (
              <Link href="/admin" className="text-sm underline underline-offset-4">
                Admin SaaS
              </Link>
            ) : null}
            <Link
              href={`/b/${sesion.negocio.slug}`}
              target="_blank"
              className="text-sm underline underline-offset-4"
            >
              Ver landing
            </Link>
            <form action={salir}>
              <button type="submit" className="text-sm text-[var(--texto-suave)] underline underline-offset-4">
                Salir
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Secciones del panel" className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1">
            {SECCIONES.map((seccion) => (
              <li key={seccion.href}>
                <Link
                  href={seccion.href}
                  className="flex min-h-10 shrink-0 items-center gap-2 rounded-[var(--radio)] px-3 text-sm font-medium hover:bg-[var(--superficie-2)]"
                >
                  <Icono nombre={seccion.icono} className="size-4" />
                  {seccion.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
