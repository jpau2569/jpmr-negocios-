import { manejarFormulario, ok } from "@/lib/api";
import { crearLead, deducirFuente, negocioParaCaptacion } from "@/lib/captacion";
import { esquemaContacto } from "@/lib/validaciones/formularios";

export const runtime = "nodejs";

/** Formulario genérico de contacto: «quiero vender», «busco vivienda», «pedir cita»… */
export async function POST(peticion: Request) {
  return manejarFormulario(peticion, esquemaContacto, { ambito: "contacto", limite: 6 }, async (datos) => {
    const negocio = await negocioParaCaptacion(datos.businessSlug);
    const resultado = await crearLead({
      negocio,
      tipo: datos.tipo,
      fuente: deducirFuente(datos.contexto?.qrCode, datos.propertyId),
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      mensaje: datos.mensaje,
      horarioPreferido: datos.horarioPreferido,
      propertyId: datos.propertyId,
      serviceId: datos.serviceId,
      qrCode: datos.contexto?.qrCode,
      sessionId: datos.contexto?.sessionId,
      path: datos.contexto?.path,
      utm: {
        source: datos.contexto?.utmSource,
        medium: datos.contexto?.utmMedium,
        campaign: datos.contexto?.utmCampaign,
      },
      peticion,
    });

    return ok({
      leadId: resultado.leadId,
      mensaje: `Hemos recibido tu solicitud. Un profesional de ${negocio.name} revisará los datos y contactará contigo.`,
    });
  });
}
