"use client";

import { useRouter } from "next/navigation";

/** Cerrar sesión. Importante en un móvil que se deja encima de la barra. */
export function BotonSalir() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/salir", { method: "POST" });
        router.push("/entrar");
        router.refresh();
      }}
      className="text-sm text-white/50 hover:text-white"
    >
      Salir
    </button>
  );
}
