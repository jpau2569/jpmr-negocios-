import { describe, expect, it } from "vitest";
import { validarArchivo, claveSubida, MAX_BYTES } from "./archivo";

const MB = 1024 * 1024;
const vid = { slug: "bosque-vivo", tipo: "video" as const, calidad: "q1080", codec: "h264", mime: "video/mp4", bytes: 10 * MB };

describe("claveSubida (idéntica al servidor)", () => {
  it("vídeo lleva calidad Y códec", () => {
    expect(claveSubida(vid)).toBe("videos/bosque-vivo/q1080-h264.mp4");
    expect(claveSubida({ ...vid, codec: "hevc" })).toBe("videos/bosque-vivo/q1080-hevc.mp4");
  });
  it("h264 y hevc de la misma calidad no se pisan", () => {
    expect(claveSubida(vid)).not.toBe(claveSubida({ ...vid, codec: "hevc" }));
  });
  it("imagen", () => {
    expect(claveSubida({ slug: "a", tipo: "thumb", mime: "image/webp", bytes: 1000 })).toBe("imagenes/a/thumb.webp");
  });
});

describe("validarArchivo", () => {
  it("vídeo de exactamente 150 MB vale; un byte más no", () => {
    expect(validarArchivo({ ...vid, bytes: 150 * MB }).ok).toBe(true);
    expect(validarArchivo({ ...vid, bytes: 150 * MB + 1 }).ok).toBe(false);
  });
  it("imagen: 5 MB vale, 5 MB + 1 no", () => {
    const img = { slug: "a", tipo: "poster" as const, mime: "image/png", bytes: 5 * MB };
    expect(validarArchivo(img).ok).toBe(true);
    expect(validarArchivo({ ...img, bytes: 5 * MB + 1 }).ok).toBe(false);
    expect(MAX_BYTES["image/png"]).toBe(5 * MB);
  });
  it("archivo vacío o NaN no valen", () => {
    expect(validarArchivo({ ...vid, bytes: 0 }).ok).toBe(false);
    expect(validarArchivo({ ...vid, bytes: NaN }).ok).toBe(false);
  });
  it("códec obligatorio y válido para vídeo", () => {
    const r = validarArchivo({ ...vid, codec: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/códec/);
    expect(validarArchivo({ ...vid, codec: "vp9" }).ok).toBe(false);
  });
  it("calidad inválida", () => expect(validarArchivo({ ...vid, calidad: "q480" }).ok).toBe(false));
  it("vídeo con mime de imagen y al revés se rechazan", () => {
    expect(validarArchivo({ ...vid, mime: "image/jpeg" }).ok).toBe(false);
    expect(validarArchivo({ slug: "a", tipo: "thumb", mime: "video/mp4", bytes: 1000 }).ok).toBe(false);
  });
  it("formatos no permitidos (gif, svg, mov)", () => {
    for (const mime of ["image/gif", "image/svg+xml", "video/quicktime", ""]) {
      expect(validarArchivo({ slug: "a", tipo: "thumb", mime, bytes: 10 }).ok).toBe(false);
    }
  });
  it("slug inválido o demasiado largo", () => {
    expect(validarArchivo({ ...vid, slug: "Mal Slug" }).ok).toBe(false);
    expect(validarArchivo({ ...vid, slug: "a".repeat(61) }).ok).toBe(false);
  });
});
