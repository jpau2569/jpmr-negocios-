import type { AutomationPreferences } from '@/types/automation';

/** Preferencias de automatización por defecto de la agencia. */
export const DEFAULT_AUTOMATION_PREFS: AutomationPreferences = {
  visitReminders: true,
  followUpAfterHours: 48,
  hotLeadMaxSilenceHours: 4,
  preferredChannel: 'whatsapp',
  defaultTemplates: {
    primeraRespuesta: 'wa-primera-respuesta',
    seguimiento: 'wa-seguimiento',
    recordatorioVisita: 'wa-recordatorio-visita',
  },
  autoCreateTasks: true,
};
