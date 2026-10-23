/* Punto único de acceso a la capa de datos (hoy mock, mañana Firebase).
   La UI importa SIEMPRE desde aquí: cambiar la fuente no toca componentes. */
export { leads, getLead } from './leads';
export { messages, getMessagesByLead } from './messages';
export { properties, getProperty, getPropertyActivity } from './mock-properties';
export type { PropertyActivity } from './mock-properties';
export { timeline, getTimelineByLead } from './timeline';
export { videos, getVideosByProperty, VIDEO_KIND_LABEL } from './mock-videos';
export {
  getExplorerRails,
  getHeroProperty,
  getCompatibleLeads,
  getRelatedProperties,
  getActiveBuyerRecommendations,
} from './mock-recommendations';
export type { Rail, LeadMatch, PropertyRecommendation } from './mock-recommendations';
