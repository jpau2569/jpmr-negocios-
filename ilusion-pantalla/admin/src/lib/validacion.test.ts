import { describe, expect, it } from "vitest";
import { FORM_VACIO, filaAForm, formAFila, parseEtiquetas, parseNumero, transicionesPermitidas, validarWallpaper, type FormWallpaper } from "./validacion";

const ok = (o: Partial<FormWallpaper> = {}): FormWallpaper => ({ ...FORM_VACIO, slug: "bosque-vivo", titulo: "Bosque vivo", ...o });

describe("validarWallpaper (espejo de los CHECK)", () => {
  it("un formulario mínimo correcto no tiene errores", () => {
    expect(validarWallpaper(ok())).toEqual({});
  });
  it("slug: rechaza mayúsculas, guiones dobles, extremos y vacío", () => {
    for (const s of ["Bosque", "a--b", "-a", "a-", "", "a b", "ñu"]) expect(validarWallpaper(ok({ slug: s })).slug).toBeDefined();
    expect(validarWallpaper(ok({ slug: "a1-b2" })).slug).toBeUndefined();
  });
  it("slug: máximo 60 (límite de la subida)", () => {
    expect(validarWallpaper(ok({ slug: "a".repeat(61) })).slug).toBeDefined();
    expect(validarWallpaper(ok({ slug: "a".repeat(60) })).slug).toBeUndefined();
  });
  it("título 3-80 en los bordes y con espacios", () => {
    expect(validarWallpaper(ok({ titulo: "ab" })).titulo).toBeDefined();
    expect(validarWallpaper(ok({ titulo: "abc" })).titulo).toBeUndefined();
    expect(validarWallpaper(ok({ titulo: "a".repeat(80) })).titulo).toBeUndefined();
    expect(validarWallpaper(ok({ titulo: "a".repeat(81) })).titulo).toBeDefined();
    expect(validarWallpaper(ok({ titulo: "  ab  " })).titulo).toBeDefined();
  });
  it("duración 3-60, admite coma decimal y vacío", () => {
    for (const d of ["2.99", "60.01", "0", "-5", "abc", "1e2"]) expect(validarWallpaper(ok({ duracion_s: d })).duracion_s).toBeDefined();
    for (const d of ["3", "60", "12,5", ""]) expect(validarWallpaper(ok({ duracion_s: d })).duracion_s).toBeUndefined();
  });
  it("resolución NNNNxNNNN", () => {
    for (const r of ["1080x1920", "720x1280", "999x999"]) expect(validarWallpaper(ok({ resolucion: r })).resolucion).toBeUndefined();
    for (const r of ["1080*1920", "12x1920", "10800x1920", "1080x1920x1", "1080X1920"]) expect(validarWallpaper(ok({ resolucion: r })).resolucion).toBeDefined();
  });
  it("fps solo 24/30/60", () => {
    for (const f of ["24", "30", "60", ""]) expect(validarWallpaper(ok({ fps_recomendado: f })).fps_recomendado).toBeUndefined();
    for (const f of ["25", "0", "59.9", "x"]) expect(validarWallpaper(ok({ fps_recomendado: f })).fps_recomendado).toBeDefined();
  });
  it("color #RRGGBB (acepta mayúsculas y minúsculas)", () => {
    for (const c of ["#4D7CFE", "#4d7cfe", ""]) expect(validarWallpaper(ok({ color_dominante: c })).color_dominante).toBeUndefined();
    for (const c of ["4D7CFE", "#FFF", "#GGGGGG", "#4D7CFE0"]) expect(validarWallpaper(ok({ color_dominante: c })).color_dominante).toBeDefined();
  });
  it("tamaño: entero > 0", () => {
    expect(validarWallpaper(ok({ tamano_archivo_bytes: "0" })).tamano_archivo_bytes).toBeDefined();
    expect(validarWallpaper(ok({ tamano_archivo_bytes: "1.5" })).tamano_archivo_bytes).toBeDefined();
    expect(validarWallpaper(ok({ tamano_archivo_bytes: "1048576" })).tamano_archivo_bytes).toBeUndefined();
  });
  it("licencia vacía o solo espacios es error (not null + política)", () => {
    expect(validarWallpaper(ok({ licencia: "   " })).licencia).toBeDefined();
  });
});

describe("conversión formulario ↔ fila", () => {
  it("vacíos a null, números a número y etiquetas sin duplicados", () => {
    const f = formAFila(ok({ duracion_s: "12,5", fps_recomendado: "60", etiquetas: " Mar, mar ,  luz,,", descripcion: " ", categoria_id: "" }));
    expect(f.duracion_s).toBe(12.5);
    expect(f.fps_recomendado).toBe(60);
    expect(f.etiquetas).toEqual(["mar", "luz"]);
    expect(f.descripcion).toBeNull();
    expect(f.categoria_id).toBeNull();
    expect(f.resolucion).toBeNull();
  });
  it("ida y vuelta conserva los datos", () => {
    const f = ok({ duracion_s: "10", etiquetas: "a, b", color_dominante: "#112233" });
    const fila = formAFila(f);
    const vuelta = filaAForm({ ...fila, categoria_id: null });
    expect(vuelta.etiquetas).toBe("a, b");
    expect(vuelta.duracion_s).toBe("10");
    expect(vuelta.color_dominante).toBe("#112233");
  });
  it("parseNumero distingue vacío (null) de basura (NaN)", () => {
    expect(parseNumero("  ")).toBeNull();
    expect(parseNumero("x")).toBeNaN();
    expect(parseNumero("3,25")).toBe(3.25);
    expect(parseEtiquetas("")).toEqual([]);
  });
});

describe("transiciones de estado", () => {
  it("no se salta la revisión desde borrador", () => {
    expect(transicionesPermitidas("borrador")).not.toContain("publicado");
  });
  it("archivado solo vuelve a borrador", () => {
    expect(transicionesPermitidas("archivado")).toEqual(["borrador"]);
  });
  it("publicado puede pausarse y archivarse, no volver a borrador", () => {
    expect(transicionesPermitidas("publicado")).toEqual(["pausado", "archivado"]);
  });
});
