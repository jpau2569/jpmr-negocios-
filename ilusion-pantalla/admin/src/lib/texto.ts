// Utilidades de texto puras (sin React).

/** Minúsculas y sin tildes: para buscar «camion» y encontrar «Camión». */
export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Slug kebab a partir de un título: sin tildes, sin símbolos, máx. 60 (límite de claveSubida). */
export function slugDesdeTitulo(titulo: string, max = 60): string {
  const base = normalizarTexto(titulo)
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, max).replace(/-+$/g, "");
}

/** Solo se pintan como imagen/enlace las URL https. */
export function esUrlHttps(u: string | null | undefined): u is string {
  if (!u) return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

/** «1,5 MB» legible. */
export function formatoBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
