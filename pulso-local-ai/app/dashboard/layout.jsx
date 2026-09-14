import Link from "next/link";
import { hayBackend } from "@/lib/datos";
import { Aviso } from "@/components/ui/basicos";
// ============================================================================
//  Panel del negocio — /dashboard
// ----------------------------------------------------------------------------
//  AVISO IMPORTANTE, y está aquí para que nadie lo pase por alto: la
//  autenticación de Supabase todavía NO está conectada. Mientras
//  SUPABASE_SERVICE_ROLE_KEY no exista, este panel enseña datos de muestra y
//  no lee nada real. Antes de publicarlo con datos de clientes hay que:
//
//    1. Conectar Supabase Auth y proteger estas rutas en middleware.
//    2. Comprobar el rol del usuario contra business_members (RLS ya lo hace
//       en la base, pero la interfaz no debe ni enseñar lo que no toca).
//
//  Se deja escrito aquí, y no solo en el README, porque un panel sin login es
//  exactamente el tipo de cosa que acaba desplegada por error.
// ============================================================================
const SECCIONES = [
    { href: "/dashboard", texto: "Resumen" },
    { href: "/dashboard/qr", texto: "QR y carteles" },
];
export default function LayoutPanel({ children }) {
    return (<div className="min-h-dvh bg-[#0e0f11] text-[#f3efe6]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <span className="font-[family-name:var(--font-display)] text-lg">Pulso Local AI</span>
          <nav className="flex gap-4 text-sm">
            {SECCIONES.map((s) => (<Link key={s.href} href={s.href} className="text-white/65 hover:text-white">
                {s.texto}
              </Link>))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {!hayBackend() ? (<Aviso tono="error" className="mb-6">
            <strong>Panel sin conectar.</strong> No hay Supabase configurado ni autenticación, así
            que lo que ves son datos de muestra. No publiques este panel hasta conectar el login y
            proteger las rutas.
          </Aviso>) : (<Aviso tono="error" className="mb-6">
            <strong>Falta el login.</strong> Hay base de datos, pero la autenticación todavía no
            está conectada: cualquiera con la URL entraría. Protege estas rutas antes de publicar.
          </Aviso>)}
        {children}
      </main>
    </div>);
}
