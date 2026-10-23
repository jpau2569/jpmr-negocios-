import { describe, expect, it } from "vitest";
import { esUrlHttps, formatoBytes, normalizarTexto, slugDesdeTitulo } from "./texto";

describe("slugDesdeTitulo", () => {
  it("quita tildes y la eñe", () => {
    expect(slugDesdeTitulo("Bosque de luciérnagas")).toBe("bosque-de-luciernagas");
    expect(slugDesdeTitulo("Montaña ÑANDÚ")).toBe("montana-nandu");
  });
  it("colapsa símbolos y recorta guiones de los extremos", () => {
    expect(slugDesdeTitulo("  ¡¡Neón & Lluvia!!  ")).toBe("neon-y-lluvia");
    expect(slugDesdeTitulo("---a---b---")).toBe("a-b");
  });
  it("título sin caracteres útiles da cadena vacía", () => {
    expect(slugDesdeTitulo("¿¿??")).toBe("");
    expect(slugDesdeTitulo("日本語")).toBe("");
  });
  it("respeta el máximo de 60 sin dejar guion final", () => {
    const s = slugDesdeTitulo("a".repeat(58) + " bbbbb");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
  it("el resultado siempre cumple el regex de la BD", () => {
    for (const t of ["Año 2024: ¡Fuego!", "x_y z", "Ça va très bien"]) {
      expect(slugDesdeTitulo(t)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("texto", () => {
  it("normalizarTexto compara sin tildes ni mayúsculas", () => {
    expect(normalizarTexto("  CAMIÓN ")).toBe("camion");
  });
  it("esUrlHttps rechaza javascript:, http y basura", () => {
    expect(esUrlHttps("https://img.x.com/a.webp")).toBe(true);
    expect(esUrlHttps("javascript:alert(1)")).toBe(false);
    expect(esUrlHttps("http://x.com/a.png")).toBe(false);
    expect(esUrlHttps("no es url")).toBe(false);
    expect(esUrlHttps(null)).toBe(false);
  });
  it("formatoBytes", () => {
    expect(formatoBytes(512)).toBe("512 B");
    expect(formatoBytes(1536)).toBe("1,5 KB");
    expect(formatoBytes(150 * 1024 * 1024)).toBe("150,0 MB");
    expect(formatoBytes(-1)).toBe("—");
    expect(formatoBytes(NaN)).toBe("—");
  });
});
