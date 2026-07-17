/* Punto único de acceso a la capa de datos (hoy mock, mañana Firebase).
   La UI importa SIEMPRE desde aquí: cambiar la fuente no toca componentes. */
export { leads, getLead } from './leads';
export { messages, getMessagesByLead } from './messages';
export { properties, getProperty } from './properties';
export { timeline, getTimelineByLead } from './timeline';
