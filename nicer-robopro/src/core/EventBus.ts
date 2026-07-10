import type { GameEvents } from '../types';

type Handler<T> = (payload: T) => void;

/**
 * Bus de eventos tipado y minimalista. Desacopla los sistemas de juego de la UI:
 * ninguno de los dos conoce al otro, solo emiten/escuchan eventos declarados en GameEvents.
 */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as Handler<GameEvents[K]>)(payload));
  }
}
