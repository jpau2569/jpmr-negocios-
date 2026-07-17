import type { Channel, LeadStage, LeadTemperature } from '@/types';
import { MailIcon, PhoneIcon, PortalIcon, WebIcon, WhatsappIcon } from '@/components/icons';

/** Metadatos de presentación por canal de entrada. */
export const channelMeta: Record<
  Channel,
  { label: string; Icon: (p: { size?: number }) => React.ReactElement }
> = {
  whatsapp: { label: 'WhatsApp', Icon: WhatsappIcon },
  email: { label: 'Email', Icon: MailIcon },
  portal: { label: 'Portal', Icon: PortalIcon },
  phone: { label: 'Teléfono', Icon: PhoneIcon },
  web: { label: 'Web', Icon: WebIcon },
};

/** Etiqueta legible por etapa del embudo. */
export const stageLabel: Record<LeadStage, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cualificado: 'Cualificado',
  visita: 'Visita',
  oferta: 'Oferta',
  cerrado: 'Cerrado',
  perdido: 'Perdido',
};

/** Mapea temperatura del lead al tono semántico de Badge. */
export const temperatureTone: Record<
  LeadTemperature,
  { label: string; tone: 'danger' | 'warning' | 'info' }
> = {
  caliente: { label: 'Caliente', tone: 'danger' },
  templado: { label: 'Templado', tone: 'warning' },
  frio: { label: 'Frío', tone: 'info' },
};
