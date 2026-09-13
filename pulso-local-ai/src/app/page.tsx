import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icono, type NombreIcono } from "@/components/ui/icono";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "PULSO LOCAL AI — El QR que convierte visitas en clientes que vuelven",
  description:
    "No te vendo una web inmobiliaria. Te instalo un punto de captación y seguimiento en cada cartel, vivienda, escaparate, dossier y visita.",
};

const LO_QUE_HACE: { icono: NombreIcono; titulo: string; texto: string }[] = [
  {
    icono: "qr",
    titulo: "Un QR por cada sitio donde ya estás",
    texto:
      "Escaparate, cartel de la vivienda, dossier, tarjeta, mostrador. Cada uno lleva a una página distinta y se mide por separado.",
  },
  {
    icono: "usuarios",
    titulo: "Capta al propietario y al comprador",
    texto:
      "Formularios cortos pensados para el móvil: vender, valorar, buscar vivienda, pedir cita. Con consentimiento guardado y versionado.",
  },
  {
    icono: "calendario",
    titulo: "Solicitudes de visita ordenadas",
    texto: "Fecha preferida, franja horaria e inmueble asociado. Todo en una lista, no en catorce conversaciones.",
  },
  {
    icono: "estrella",
    titulo: "Reputación sin trucos",
    texto:
      "Opinión privada primero y acceso voluntario a tu enlace oficial de Google, con cualquier nota. Sin filtrar, sin premiar, sin condicionar.",
  },
  {
    icono: "grafico",
    titulo: "Saber qué cartel funciona",
    texto: "Escaneos, fichas vistas, clics a WhatsApp y conversiones por QR y por inmueble. Analítica sin datos personales.",
  },
  {
    icono: "chat",
    titulo: "Un asistente que no se inventa nada",
    texto:
      "Responde solo con la información que apruebas. Si la pregunta es legal, fiscal o financiera, deriva a una persona.",
  },
];

const PARA_QUIEN = [
  "Inmobiliarias y agentes",
  "Asesorías fiscales, laborales y jurídicas",
  "Administradores de fincas",
  "Y después: restaurantes, clínicas, talleres, comercio local",
];

export default function LandingSaas() {
  return (
    <div className="min-h-dvh bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <span className="text-sm font-bold tracking-widest text-[var(--marca)] uppercase">Pulso Local AI</span>
          <div className="flex items-center gap-2">
            <Button asChild variant="fantasma" size="sm">
              <Link href="/b/asesoria-castresana">Ver demo</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="contenido">
        <section className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <div className="animar-entrada max-w-3xl">
            <Badge tono="acento">Para negocio local</Badge>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--marca)] sm:text-5xl">
              El QR que convierte visitas en clientes que vuelven.
            </h1>
            <p className="mt-5 text-lg text-[var(--texto-suave)]">
              No te vendo una web inmobiliaria. Te instalo un punto de captación y seguimiento en cada cartel,
              vivienda, escaparate, dossier y visita.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/b/asesoria-castresana">
                  Ver la demo de una asesoría real
                  <Icono nombre="flecha" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="contorno">
                <Link href="/login">Tengo una cuenta</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--borde)] bg-[var(--superficie)]">
          <div className="mx-auto grid max-w-5xl gap-6 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {LO_QUE_HACE.map((bloque) => (
              <Card key={bloque.titulo} className="h-full">
                <CardHeader>
                  <Icono nombre={bloque.icono} className="size-6 text-[var(--acento)]" />
                  <CardTitle>{bloque.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[var(--texto-suave)]">{bloque.texto}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-2xl font-bold tracking-tight">Empezamos por lo que ya conoces</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PARA_QUIEN.map((quien) => (
              <li key={quien} className="flex items-start gap-3 rounded-[var(--radio)] bg-[var(--superficie)] p-4">
                <Icono nombre="ok" className="mt-0.5 size-5 shrink-0 text-[var(--exito)]" />
                <span className="text-sm">{quien}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20">
          <div className="rounded-[var(--radio)] bg-[var(--marca)] p-8 text-[var(--marca-contraste)] sm:p-12">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pruébalo siete días con tu propio negocio</h2>
            <p className="mt-3 max-w-2xl text-[color-mix(in_srgb,var(--marca-contraste)_85%,transparent)]">
              Montamos tu espacio con tus servicios, tus inmuebles y tus QR. Al séptimo día la demo se apaga sola:
              si te sirve, se reactiva; si no, no has firmado nada.
            </p>
            <Button asChild variant="acento" size="lg" className="mt-7">
              <Link href="/b/asesoria-castresana">Ver cómo queda</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto max-w-5xl px-5 py-8 text-sm text-[var(--texto-suave)]">
          <p className="font-semibold text-[var(--texto)]">PULSO LOCAL AI</p>
          <p className="mt-1">
            Los espacios de demostración usan datos ficticios marcados como tales. Nunca se publican inmuebles,
            precios ni reseñas inventados como si fueran reales.
          </p>
        </div>
      </footer>
    </div>
  );
}
