"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { Skeleton } from "./estados";

const MENU = [
  { href: "/wallpapers", texto: "Wallpapers" },
  { href: "/categorias", texto: "Categorías" },
  { href: "/destacados", texto: "Destacados" },
  { href: "/metricas", texto: "Métricas" },
  { href: "/reportes", texto: "Reportes" },
  { href: "/flags", texto: "Flags" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { estado, email, rol, salir } = useAuth();
  const router = useRouter();
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => { if (estado === "anonimo" || estado === "sin-permiso") router.replace("/login"); }, [estado, router]);

  if (estado === "sin-config") return <main className="p-6"><p role="alert">Panel sin configurar: faltan las variables NEXT_PUBLIC_SUPABASE_*.</p></main>;
  if (estado !== "ok") return <main className="p-6 max-w-xl mx-auto"><Skeleton filas={3} /></main>;

  return (
    <div className="min-h-screen md:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-azul focus:text-grafito focus:p-3">Saltar al contenido</a>
      <header className="md:hidden flex items-center justify-between p-3 border-b border-borde bg-superficie">
        <span className="font-bold">Ilusión Pantalla</span>
        <button type="button" className="btn" aria-expanded={abierto} aria-controls="menu-lateral" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cerrar menú" : "Menú"}
        </button>
      </header>
      <aside id="menu-lateral" className={`${abierto ? "block" : "hidden"} md:block md:w-60 md:shrink-0 bg-superficie border-r border-borde p-4 md:min-h-screen`}>
        <p className="hidden md:block font-bold text-lg mb-1">Ilusión Pantalla</p>
        <p className="text-gris text-sm mb-4">Administración</p>
        <nav aria-label="Principal">
          <ul className="space-y-1">
            {MENU.map((m) => {
              const activo = ruta === m.href || ruta.startsWith(m.href + "/");
              return (
                <li key={m.href}>
                  <Link href={m.href} onClick={() => setAbierto(false)} aria-current={activo ? "page" : undefined}
                    className={`flex items-center min-h-11 px-3 rounded-xl ${activo ? "bg-azul text-grafito font-semibold" : "text-suave hover:bg-grafito"}`}>
                    {m.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-6 border-t border-borde pt-4 text-sm">
          <p className="text-gris break-all">{email}</p>
          <p className="text-gris mb-2">Rol: {rol}</p>
          <button type="button" className="btn w-full" onClick={() => void salir()}>Cerrar sesión</button>
        </div>
      </aside>
      <main id="contenido" className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl">{children}</main>
    </div>
  );
}
