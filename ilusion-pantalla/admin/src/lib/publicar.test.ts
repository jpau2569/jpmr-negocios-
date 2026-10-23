import { describe, expect, it } from "vitest";
import { faltaParaPublicar, fechaAlPublicar, type DatosPublicables } from "./publicar";

const completo: DatosPublicables = {
  titulo: "Bosque vivo", categoria_id: "c1", licencia: "original-propia", creditos: null,
  url_thumbnail: "https://i/t.webp", url_poster: "https://i/p.webp",
};
const v = [{ id: "a1" }];

describe("faltaParaPublicar", () => {
  it("completo = nada falta", () => expect(faltaParaPublicar(completo, v)).toEqual([]));
  it("sin vídeo", () => expect(faltaParaPublicar(completo, [])).toEqual(["Al menos un archivo de vídeo"]));
  it("thumbnail o poster en blanco cuentan como ausentes", () => {
    const f = faltaParaPublicar({ ...completo, url_thumbnail: "  ", url_poster: null }, v);
    expect(f).toEqual(["Miniatura (thumbnail)", "Póster"]);
  });
  it("categoría ausente", () => expect(faltaParaPublicar({ ...completo, categoria_id: null }, v)).toEqual(["Categoría"]));
  it("título corto", () => expect(faltaParaPublicar({ ...completo, titulo: " ab " }, v)).toHaveLength(1));
  it("licencia vacía", () => expect(faltaParaPublicar({ ...completo, licencia: " " }, v)).toEqual(["Licencia"]));
  it("licencia de terceros exige créditos", () => {
    expect(faltaParaPublicar({ ...completo, licencia: "cc-by" }, v)).toHaveLength(1);
    expect(faltaParaPublicar({ ...completo, licencia: "cc-by", creditos: "  " }, v)).toHaveLength(1);
    expect(faltaParaPublicar({ ...completo, licencia: "cc-by", creditos: "Ana" }, v)).toEqual([]);
  });
  it("acumula todo lo que falta", () => {
    expect(faltaParaPublicar({ titulo: "", categoria_id: null, licencia: "", creditos: null, url_thumbnail: null, url_poster: null }, [])).toHaveLength(6);
  });
});

describe("fechaAlPublicar", () => {
  it("conserva la fecha existente", () => expect(fechaAlPublicar("2026-01-02T03:04:05.000Z")).toBe("2026-01-02T03:04:05.000Z"));
  it("usa ahora si no hay o es inválida (la BD exige fecha)", () => {
    const ahora = new Date("2026-05-05T10:00:00Z");
    expect(fechaAlPublicar(null, ahora)).toBe("2026-05-05T10:00:00.000Z");
    expect(fechaAlPublicar("basura", ahora)).toBe("2026-05-05T10:00:00.000Z");
  });
});
