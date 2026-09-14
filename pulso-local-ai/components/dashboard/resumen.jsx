"use client";
// ============================================================================
//  Resumen del panel
// ----------------------------------------------------------------------------
//  Lo que un hostelero quiere saber en diez segundos: cuánta gente escaneó,
//  qué miraron y cuántos acabaron haciendo algo. Las métricas de vanidad
//  (visitas totales) van pequeñas; las de conversión, grandes.
//
//  El embudo de abajo es la pieza que vende el producto en la siguiente
//  reunión: "de 240 escaneos salieron 18 reservas" es una frase que un dueño
//  entiende y con la que decide si sigue pagando.
// ============================================================================
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, } from "recharts";
import { Tarjeta } from "@/components/ui/basicos";
const ACENTO = "#d4a03c";
const VINO = "#8e2a33";
function Dato({ valor, texto, grande = false }) {
    return (<Tarjeta className="p-4">
      <p className={grande ? "text-3xl font-semibold tabular-nums" : "text-2xl font-semibold tabular-nums"}>
        {valor.toLocaleString("es-ES")}
      </p>
      <p className="mt-0.5 text-xs text-white/55">{texto}</p>
    </Tarjeta>);
}
export function Resumen({ metricas, demo }) {
    const embudo = [
        { paso: "Escanean", valor: metricas.escaneos },
        { paso: "Ven la carta", valor: metricas.vistasCarta },
        { paso: "Ven el menú", valor: metricas.vistasMenuDia },
        { paso: "Contactan", valor: metricas.clicsWhatsapp + metricas.llamadas },
        { paso: "Reservan", valor: metricas.reservas + metricas.grupos },
    ];
    const tasa = metricas.escaneos > 0
        ? ((metricas.reservas + metricas.grupos + metricas.contactos) / metricas.escaneos) * 100
        : 0;
    return (<div className="space-y-6">
      {demo ? (<p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          ⚠ Datos de muestra para enseñar el panel. No corresponden a ninguna visita real.
        </p>) : null}

      <section>
        <h2 className="text-sm font-semibold text-white/70">Lo que ha pasado</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato valor={metricas.escaneos} texto="Escaneos de QR" grande/>
          <Dato valor={metricas.reservas} texto="Solicitudes de reserva" grande/>
          <Dato valor={metricas.grupos} texto="Peticiones de grupo" grande/>
          <Dato valor={metricas.contactos} texto="Contactos captados" grande/>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white/70">Del escaneo a la mesa</h2>
        <Tarjeta className="mt-3 p-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={embudo} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false}/>
                <XAxis dataKey="paso" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#17181b", border: "1px solid #2a2d33", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#f3efe6" }}/>
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} name="Personas">
                  {embudo.map((_, i) => (<Cell key={i} fill={i === embudo.length - 1 ? VINO : ACENTO}/>))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-white/55">
            De cada 100 personas que escanean, <strong className="text-white">{tasa.toFixed(1)}</strong> acaban
            reservando, preguntando por un grupo o dejando su contacto.
          </p>
        </Tarjeta>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-white/70">Por dónde entran</h2>
          <Tarjeta className="mt-3 divide-y divide-white/8">
            {metricas.porQr.length === 0 ? (<p className="p-4 text-sm text-white/50">Todavía no hay escaneos registrados.</p>) : (metricas.porQr.map((q) => (<div key={q.etiqueta} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{q.etiqueta}</span>
                  <span className="font-semibold tabular-nums">{q.escaneos}</span>
                </div>)))}
          </Tarjeta>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white/70">Platos más mirados</h2>
          <Tarjeta className="mt-3 divide-y divide-white/8">
            {metricas.platosMasVistos.length === 0 ? (<p className="p-4 text-sm text-white/50">Todavía no hay platos abiertos.</p>) : (metricas.platosMasVistos.map((p) => (<div key={p.nombre} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate">{p.nombre}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{p.vistas}</span>
                </div>)))}
          </Tarjeta>
        </section>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white/70">Todo lo demás</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato valor={metricas.visitasUnicas} texto="Visitas únicas"/>
          <Dato valor={metricas.vistasCarta} texto="Veces que se vio la carta"/>
          <Dato valor={metricas.vistasMenuDia} texto="Veces que se vio el menú"/>
          <Dato valor={metricas.clicsWhatsapp} texto="Clics a WhatsApp"/>
          <Dato valor={metricas.llamadas} texto="Llamadas desde la web"/>
          <Dato valor={metricas.opiniones} texto="Opiniones recibidas"/>
          <Dato valor={metricas.clicsResena} texto="Clics a reseñar en Google"/>
          <Dato valor={metricas.contactos} texto="Altas en novedades"/>
        </div>
      </section>
    </div>);
}
