import type { Metadata } from "next";
import { modoAcceso } from "@/lib/sesion";
import { FormularioEntrar } from "@/components/dashboard/formulario-entrar";

// ============================================================================
//  Acceso al panel — /entrar
// ----------------------------------------------------------------------------
//  Dos estados posibles:
//   · Configurado  → formulario de clave.
//   · Sin configurar → se explica qué falta. No hay forma de colarse: el
//     middleware reescribe cualquier ruta del panel a esta página.
// ============================================================================

export const metadata: Metadata = {
  title: "Entrar · Pulso Local AI",
  robots: { index: false, follow: false },
};

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; cerrado?: string }>;
}) {
  const { desde, cerrado } = await searchParams;
  const acceso = modoAcceso(process.env);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0e0f11] px-5 py-16 text-[#f3efe6]">
      <div className="w-full max-w-sm">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#d4a03c]">
          Pulso Local AI
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl">Panel del negocio</h1>

        {!acceso.abierto || cerrado ? (
          <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-4">
            <p className="text-sm font-semibold text-amber-200">El panel está cerrado</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
              {acceso.motivo ?? "No hay forma de acceso configurada."}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/60">
              Está cerrado a propósito: es preferible que el panel no funcione a que quede abierto
              con datos de clientes dentro.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              Aquí dentro hay reservas, teléfonos y contactos de clientes. Por eso pide clave.
            </p>
            <FormularioEntrar desde={desde ?? "/dashboard"} />
          </>
        )}

        <p className="mt-8 text-center text-[0.7rem] text-white/35">
          Si esto te ha salido buscando la carta de un bar, vuelve al enlace del QR.
        </p>
      </div>
    </div>
  );
}
