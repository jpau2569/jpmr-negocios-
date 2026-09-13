"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./acciones";
import { Button } from "@/components/ui/button";
import { Campo, Input } from "@/components/ui/campos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Aviso } from "@/components/ui/aviso";

export default function Login() {
  const [estado, accion, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-[var(--acento)] uppercase">PULSO LOCAL AI</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Entrar al panel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acceso del equipo</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={accion} className="flex flex-col gap-4">
            <Campo etiqueta="Correo" obligatorio>
              <Input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" />
            </Campo>
            <Campo etiqueta="Contraseña" obligatorio>
              <Input name="password" type="password" autoComplete="current-password" required />
            </Campo>
            {estado.error ? <Aviso tono="peligro">{estado.error}</Aviso> : null}
            <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
              {enviando ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-[var(--texto-suave)]">
        Las cuentas las crea quien administra el espacio.{" "}
        <Link href="/" className="underline underline-offset-4">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
