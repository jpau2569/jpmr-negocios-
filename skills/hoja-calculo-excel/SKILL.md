---
name: hoja-calculo-excel
description: Crear tablas y hojas de cálculo para Excel o Google Sheets (cartera, gastos, comisiones, listados de clientes, comparativas) en CSV que Excel en español abre bien, más las fórmulas exactas para pegar.
---

# Skill: Hoja de cálculo para Excel

## Cuándo usarla
Pau pide una tabla, un Excel, un listado, un control de gastos o comisiones, una comparativa, o «pásamelo a Excel».

## Método
1. **Columnas primero.** Propón las columnas (máximo 12) con su tipo: texto, número, euros, fecha o porcentaje. Si Pau no dice nada, usa valores por defecto sensatos y avanza.
2. **Formato para Excel en España:**
   - separador de columnas punto y coma (;);
   - decimales con coma (1234,5);
   - sin separador de miles en los datos;
   - fechas dd/mm/aaaa;
   - textos con punto y coma o saltos de línea, entre comillas dobles.
3. **Fórmulas aparte**, en español de Excel: SUMA, PROMEDIO, SI, BUSCARV o BUSCARX, CONTAR.SI, SUMAR.SI.CONJUNTO, separadas por punto y coma. Indica la celda donde va cada una (por ejemplo, «En F2: =D2*E2, y arrastra hacia abajo»). Si Pau usa Google Sheets, recuerda que allí los nombres pueden ir en inglés según su configuración regional.
4. **Datos reales o en blanco.** Nunca rellenes la tabla con cifras de ejemplo como si fueran reales. Si Pau quiere ejemplo, márcalo como «EJEMPLO». Usa calcular para cualquier total que presentes en el texto. Para cálculos complejos, pide ayuda a IYAN (consultar_equipo).

## Entrega estándar
- Un bloque ```csv con la cabecera y las filas. El chat ofrece el botón «Descargar Excel (CSV)», que se abre con doble clic en Excel.
- Debajo: las fórmulas para pegar, cómo dar formato (euros, fechas, filtros, inmovilizar la primera fila) y, si ayuda, un gráfico recomendado.

## Norma
Una tabla que Pau pueda abrir y usar en 30 segundos. Si los datos vienen de su cartera, usa mi_cartera y cita las referencias.
