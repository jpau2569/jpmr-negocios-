/* Motor de IA comercial — nivel 1 heurístico, nivel 2 conectable (provider). */
export { scoreLead } from './scoreLead';
export { classifyIntent } from './classifyIntent';
export { summarizeLead } from './summarizeLead';
export { suggestReply } from './suggestReply';
export { recommendNextAction } from './recommendNextAction';
export { matchProperty, matchPropertiesForLead } from './matchProperty';
export { generateAlerts } from './generateAlerts';
export { aiProvider, heuristicProvider } from './provider';
export type { AIProvider, LeadContext } from './provider';
