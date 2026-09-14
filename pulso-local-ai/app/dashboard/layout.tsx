import Link from "next/link";
import { hayBackend } from "@/lib/datos";
import { Aviso } from "@/components/ui/basicos";
import { BotonSalir } from "@/components/dashboard/boton-salir";

// ============================================================================
//  Panel del negocio — /dashboard
// ----------------------------------------------------------------------------
//  Estas rutas están protegidas por middleware.ts: nadie llega hasta aquí sin
//  una sesión válida, porque la comprobación corre ANTES de renderizar.
//
//  Es necesario porque el panel lee con service_role, que salta RLS: aquí la
//  base ya no protege nada y el control tiene que ser de verdad.
//
//  Pendiente para cuando haya Supabase Auth: una cuenta por persona y el rol
//  sacado de business_members, para que un empleado vea las reservas pero no
//  la configuración. Hoy la clave da acceso completo, y es de Pau.
// ============================================================================

const SECCIONES = [
  { href: "/dashboard", texto: "Resumen" },
  { href: "/dashboard/menu-del-dia", texto: "Menú del día" },
  { href: "/dashboard/reservas", texto: "Reservas" },
  { href: "/dashboard/carta", texto: "Carta" },
  { href: "/dashboard/qr", texto: "QR" },
];

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0e0f11] text-[#f3efe6]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <span className="font-[family-name:var(--font-display)] text-lg">Pulso Local AI</span>
          <nav className="flex gap-4 text-sm">
            {SECCIONES.map((s) => (
              <Link key={s.href} href={s.href} className="text-white/65 hover:text-white">
                {s.texto}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <BotonSalir />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {!hayBackend() ? (
          <Aviso className="mb-6">
            <strong>Sin base de datos conectada.</strong> Lo que ves son datos de muestra para poder
            enseñar el panel. Conecta Supabase para ver los números reales.
          </Aviso>
        ) : null}
        {children}
      </main>
    </div>
  );
}
