import { describe, expect, it } from "vitest";
import { cambiosDeOrden, mover, ordenarDestacados, parseOrden } from "./destacados";
import { escalar, eventosPorDia, porcentaje } from "./metricas";

const w = (id: string, o: number | null, titulo = id) => ({ id, titulo, destacado_orden: o });

describe("ordenarDestacados", () => {
  it("excluye nulos y ordena; el 0 cuenta como destacado", () => {
    const r = ordenarDestacados([w("c", 3), w("n", null), w("a", 0), w("b", 1)]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("empates estables por título", () => {
    expect(ordenarDestacados([w("2", 1, "Zorro"), w("1", 1, "Árbol")]).map((x) => x.id)).toEqual(["1", "2"]);
  });
  it("lista vacía", () => expect(ordenarDestacados([])).toEqual([]));
});

describe("parseOrden", () => {
  it("acepta enteros ≥ 0", () => {
    expect(parseOrden("5")).toBe(5);
    expect(parseOrden(" 0 ")).toBe(0);
  });
  it("rechaza negativos, decimales, vacío y basura", () => {
    for (const x of ["-1", "1.5", "", "abc", "1e3", null, undefined, "99999999999999999999"]) expect(parseOrden(x as string)).toBeNull();
  });
});

describe("mover y cambiosDeOrden", () => {
  it("mover intercambia y no muta", () => {
    const l = ["a", "b", "c"];
    expect(mover(l, 1, -1)).toEqual(["b", "a", "c"]);
    expect(l).toEqual(["a", "b", "c"]);
  });
  it("en los extremos no hace nada", () => {
    const l = ["a", "b"];
    expect(mover(l, 0, -1)).toBe(l);
    expect(mover(l, 1, 1)).toBe(l);
    expect(mover(l, 7, 1)).toBe(l);
  });
  it("cambiosDeOrden solo devuelve lo que cambia y cierra huecos", () => {
    const antes = [{ id: "a", orden: 1 }, { id: "b", orden: 5 }, { id: "c", orden: 9 }];
    expect(cambiosDeOrden(antes, [{ id: "a" }, { id: "b" }, { id: "c" }])).toEqual([{ id: "b", orden: 2 }, { id: "c", orden: 3 }]);
    expect(cambiosDeOrden([{ id: "a", orden: 1 }, { id: "b", orden: 2 }], [{ id: "b" }, { id: "a" }])).toEqual([{ id: "b", orden: 1 }, { id: "a", orden: 2 }]);
  });
});

describe("métricas", () => {
  it("eventosPorDia suma, ordena e ignora filas rotas", () => {
    const r = eventosPorDia([
      { dia: "2026-02-02", evento: "a", eventos: 3, instalaciones: 1 },
      { dia: "2026-02-01", evento: "a", eventos: 2, instalaciones: 1 },
      { dia: "2026-02-02", evento: "b", eventos: 4, instalaciones: 1 },
      { dia: "", evento: "x", eventos: 9, instalaciones: 1 },
      { dia: "2026-02-03", evento: "x", eventos: NaN, instalaciones: 1 },
    ]);
    expect(r).toEqual([{ dia: "2026-02-01", total: 2 }, { dia: "2026-02-02", total: 7 }]);
  });
  it("escalar: el mayor ocupa el máximo, ceros y NaN no rompen", () => {
    expect(escalar([5, 10, 0], 100)).toEqual([50, 100, 0]);
    expect(escalar([0, 0], 100)).toEqual([0, 0]);
    expect(escalar([1, 1000], 100)).toEqual([1, 100]);
    expect(escalar([NaN, 4], 10)).toEqual([0, 10]);
    expect(escalar([], 10)).toEqual([]);
  });
  it("porcentaje sin división por cero", () => {
    expect(porcentaje(1, 0)).toBe("—");
    expect(porcentaje(1, 3)).toBe("33,3 %");
  });
});
