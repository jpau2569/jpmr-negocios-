/* Genera las imágenes de OLVIDO DE PAU AGENDA a partir del logo JP de Pau
   (agenda/logo-jp-original.webp, 1672 × 941). Usa Python + Pillow.
   Salen: logo-jp.webp (1200 px, para la app), icono-180/192/512 (monograma JP,
   también en la cabecera), icono-maskable-512 y presentacion-4k.png (3840 × 2160).
   Ojo: la de 4K es una AMPLIACIÓN del original (1672 px de ancho): sirve
   para pantallas grandes, pero no tiene más detalle que la imagen de partida.
   Uso:  node agenda/herramientas/generar-imagenes.mjs                      */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const python = String.raw`
import sys
from PIL import Image, ImageDraw, ImageFilter
d = sys.argv[1]
orig = Image.open(d + '/logo-jp-original.webp').convert('RGB')
FONDO = (5, 14, 34)

def lienzo(n):
    # Fondo azul noche con un leve foco central, como el del logo.
    base = Image.new('RGB', (n, n), FONDO)
    luz = Image.new('L', (n, n), 0)
    ImageDraw.Draw(luz).ellipse((n * .1, n * .05, n * .9, n * .85), fill=60)
    luz = luz.filter(ImageFilter.GaussianBlur(n / 6))
    return Image.composite(Image.new('RGB', (n, n), (14, 30, 66)), base, luz)

# Monograma JP sin la palabra AGENDA, con los bordes fundidos con el fondo.
jp = orig.crop((470, 140, 1200, 725))
mascara = Image.new('L', jp.size, 0)
ImageDraw.Draw(mascara).rounded_rectangle((18, 18, jp.width - 18, jp.height - 18), 40, fill=255)
mascara = mascara.filter(ImageFilter.GaussianBlur(14))

def marca(n, ocupa):
    c = lienzo(n)
    ancho = int(n * ocupa)
    alto = int(jp.height * ancho / jp.width)
    j = jp.resize((ancho, alto), Image.LANCZOS)
    m = mascara.resize((ancho, alto), Image.LANCZOS)
    c.paste(j, ((n - ancho) // 2, (n - alto) // 2), m)
    return c

for n in (180, 192, 512):
    marca(n, .86).save(d + '/icono-%d.png' % n, optimize=True)
marca(512, .66).save(d + '/icono-maskable-512.png', optimize=True)

# 4K: el logo entero ampliado (16:9 como el original) con un poco de enfoque.
grande = orig.resize((3840, 2161), Image.LANCZOS).crop((0, 0, 3840, 2160))
grande = grande.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
grande.save(d + '/presentacion-4k.png', optimize=True)
# Versión ligera para la app (pantalla de bienvenida y panel).
orig.resize((1200, 675), Image.LANCZOS).save(d + '/logo-jp.webp', quality=88)
print('ok')
`;
console.log(execFileSync('python3', ['-c', python, DIR], { encoding: 'utf8' }).trim());
