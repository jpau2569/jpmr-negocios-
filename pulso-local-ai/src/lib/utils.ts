import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo los conflictos (la última gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
