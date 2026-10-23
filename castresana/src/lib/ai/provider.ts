/* ============================================================================
   AIProvider — punto de extensión hacia LLMs (nivel 2).
   ----------------------------------------------------------------------------
   Hoy la app usa `heuristicProvider`: reglas deterministas, gratis, sin
   latencia y explicables. Cuando queramos redacción más natural o análisis
   de texto profundo, se crea otra implementación de ESTA MISMA interfaz
   (p. ej. `claudeProvider` llamando a la API de Anthropic desde una ruta
   de servidor) y se cambia UNA línea en los servicios. La UI no se entera.

   Regla para el nivel 2: el LLM REDACTA y RESUME; el scoring, el matching y
   las alertas siguen siendo deterministas. Los números deben ser auditables.
   ============================================================================ */

import type { Lead, Message, Property, Visit } from '@/types';
import type {
  IntentClassification,
  LeadScore,
  LeadSummary,
  NextAction,
  PropertyMatch,
  SuggestedReply,
} from '@/types/ai';
import { classifyIntent } from './classifyIntent';
import { matchPropertiesForLead } from './matchProperty';
import { recommendNextAction } from './recommendNextAction';
import { scoreLead } from './scoreLead';
import { suggestReply } from './suggestReply';
import { summarizeLead } from './summarizeLead';

export interface LeadContext {
  lead: Lead;
  messages: Message[];
  visits: Visit[];
  property?: Property | null;
  now?: Date;
}

export interface AIProvider {
  name: string;
  match(lead: Lead, properties: Property[], limit?: number): PropertyMatch[];
  score(ctx: LeadContext, matches: PropertyMatch[]): LeadScore;
  classify(ctx: LeadContext): IntentClassification;
  nextAction(ctx: LeadContext, matches: PropertyMatch[], score: LeadScore): NextAction;
  summarize(ctx: LeadContext, score: LeadScore, nextAction: NextAction): LeadSummary;
  replies(ctx: LeadContext, matches: PropertyMatch[], nextAction: NextAction): SuggestedReply[];
}

/** Implementación por defecto: heurística determinista (nivel 1). */
export const heuristicProvider: AIProvider = {
  name: 'heuristic-v1',
  match: (lead, properties, limit) => matchPropertiesForLead(lead, properties, limit),
  score: (ctx, matches) =>
    scoreLead({ lead: ctx.lead, messages: ctx.messages, visits: ctx.visits, matches, now: ctx.now }),
  classify: (ctx) => classifyIntent(ctx.lead, ctx.messages),
  nextAction: (ctx, matches, score) =>
    recommendNextAction({
      lead: ctx.lead,
      messages: ctx.messages,
      visits: ctx.visits,
      matches,
      score,
      now: ctx.now,
    }),
  summarize: (ctx, score, nextAction) =>
    summarizeLead({
      lead: ctx.lead,
      messages: ctx.messages,
      property: ctx.property,
      score,
      nextAction,
      now: ctx.now,
    }),
  replies: (ctx, matches, nextAction) =>
    suggestReply({
      lead: ctx.lead,
      messages: ctx.messages,
      property: ctx.property,
      matches,
      nextAction,
      now: ctx.now,
    }),
};

/** Provider activo. Nivel 2: sustituir aquí por el provider con LLM. */
export const aiProvider: AIProvider = heuristicProvider;
