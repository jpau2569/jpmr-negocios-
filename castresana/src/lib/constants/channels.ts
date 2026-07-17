import type { Channel } from '@/types';

export const CHANNELS: Record<Channel, { label: string }> = {
  whatsapp: { label: 'WhatsApp' },
  email: { label: 'Email' },
  portal: { label: 'Portal' },
  telefono: { label: 'Teléfono' },
  web: { label: 'Web' },
};
