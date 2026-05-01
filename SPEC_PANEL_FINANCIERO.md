# PANEL FINANCIERO SADAMA / AMADEUS — Especificación

Versión 1.1.0. Fuente: TOTAL RAPIDO 252.xlsx (hojas DATOS y ANALISIS SADAMA AMADEUS).

## STACK
- Next.js 14 + TypeScript
- Tailwind + shadcn/ui
- Recharts
- Zustand
- date-fns
- Vitest

## ESTRUCTURA
/app/page.tsx                 dashboard
/app/executive/page.tsx       one-pager (ver suplemento)
/components/{ui,charts,filters,executive}
/lib/{types,parser,calc,aggregations,periods,format,executive}.ts
/lib/__tests__
/data/sadama_amadeus_v1.json
/data/sadama_amadeus_executive.json
/stores/filters.ts

## DATOS
Usar /data/sadama_amadeus_v1.json:
{
  meta: {generated, source, schema_version, fecha_format, moneda_base, warnings_count, warnings},
  datos:    {description, count, rango:{min,max}, rows: DatosRow[]},     // FUENTE
  analisis: {description, count, rango:{min,max}, rows: AnalisisRow[]}   // VALIDACION
}

## TIPOS
interface DatosRow {
  _row, fecha,  // ISO YYYY-MM-DD
  sadama: {banco, inventarios, cxc, cxp, fact_dia_mes},
  amadeus: {
    inventarios, cxc, fact_dia_mes, compras_mes,
    cxp: {sandvik, vargus, mexicana, otros},
    bancos: {bajio_usd, bajio_mxn, hsbc}
  },
  tc
}

interface AnalisisRow {
  // Igual + total_cxp_amadeus, total_bancos_amadeus,
  // flujos.{sadama,amadeus,total}, totales.{bancos,inventario}, dif_*
}

## CALCULOS (en /lib/calc.ts, puros)
totalCxpAmadeus = sandvik + vargus + mexicana + otros
totalBancosAmadeus = (bajio_usd * tc) + bajio_mxn + hsbc
flujoAmadeus = (cxc_amadeus + totalBancosAmadeus) - totalCxpAmadeus
flujoSadama = cxc_sadama - cxp_sadama + banco_sadama
flujoTotal = flujoAmadeus + flujoSadama
bancosTotal = totalBancosAmadeus + banco_sadama
inventarioTotal = inventarios_amadeus + inventarios_sadama
cxcTotal = cxc_sadama + cxc_amadeus
cxpTotal = cxp_sadama + totalCxpAmadeus

dif_X(dia) = X(dia) - X(dia_anterior)

VALIDAR: 5 fechas aleatorias contra AnalisisRow tolerancia 0.01.

## AGREGACION (/lib/aggregations.ts)
Granularidades: day, week (ISO lun-dom), month (YYYY-MM), year

Reglas:
- Stocks (bancos, cxc, cxp, inventarios, flujos, totales): ULTIMO valor del periodo
- Acumulados (fact_dia_mes_*, compras_mes_amadeus): ULTIMO del periodo
- TC: PROMEDIO + min/max
- Diffs: RECALCULAR contra periodo anterior

API:
groupByPeriod(rows, granularity): Map<string, DatosRow[]>
aggregatePeriod(rows): AggregatedRow
buildSeries(rows, granularity): AggregatedRow[]

Etiquetas: "06 Abr 2025", "Sem 14 - 2025", "Abr 2025", "2025"

## COMPARATIVOS (/lib/periods.ts)
Modos: none, prev, yoy, custom
getPreviousPeriod(start, end, gran): {start, end}
getYoYPeriod(start, end): {start, end}

Visualizacion:
- KPI: valor + delta_$ + delta_% + flecha + "vs [periodo]"
- Lineas: actual solida, comparativa punteada opacity 0.5
- Barras: pareadas
- Tablas: A | B | delta_$ | delta_%

## FORMATOS
formatMXN(n)   "$1,234,567"
formatUSD(n)   "US$1,234.56"
formatPct(n)   "+12.3%"
formatDelta(n, isCurrency)
Locale: es-MX. Negativos en (paréntesis). Cero como em-dash.

## PALETA
SADAMA #1e40af, AMADEUS #7c3aed, Consolidado #059669
Positivo #10b981, Negativo #ef4444, Alerta #f59e0b, Neutro #6b7280

## SEMAFORO
- Delta+ en CXC/Ventas/Bancos/Inventario/Flujo: verde
- Delta- en esos: rojo
- Delta+ en CXP/Compras: rojo (mas deuda)
- Delta- en CXP/Compras: verde
- |Delta%| < 1%: ambar (estable)

## ESTADO (Zustand)
interface FilterState {
  granularity: 'day'|'week'|'month'|'year';
  period: {start, end};
  comparison: {mode: 'none'|'prev'|'yoy'|'custom'; customPeriod?};
  domain: 'sadama'|'amadeus'|'consolidated';
  currency: 'MXN'|'USD';
}

## DASHBOARD PRINCIPAL (/)
Header sticky 2 filas:
- Fila 1: granularidad + selector + atajos (Hoy, 7d, 30d, MTD, YTD, Todo)
- Fila 2: comparacion + dominio + moneda + PDF

KPIs (6): Flujo Total, Bancos, Inventario, CXC, CXP, TC

Graficas 2x2:
1. ComposedChart Flujos (3 lineas + TC eje secundario)
2. StackedBar CXP por Proveedor
3. AreaChart Bancos por Cuenta
4. LineChart Inventarios

Tabla Variaciones por Periodo (paginada 20, exportable CSV).

## TESTS
- calc.test.ts: cada formula + validacion contra AnalisisRow
- aggregations.test.ts: stocks ultimo, TC promedio, semana ISO
- periods.test.ts: prev y yoy correctos
- executive.test.ts (ver suplemento)

## ENTREGABLES
1-6. lib/* archivos
7-8. components/ui y components/charts
9. app/page.tsx
10. app/executive/page.tsx
11. stores/filters.ts
12-13. data/*.json
14. README

## ORDEN DE TRABAJO
1. Setup proyecto
2. Tipos + parser
3. Calc + tests
4. Aggregations + periods + tests
5. Format + UI base
6. Filtros + Zustand
7. Dashboard ejecutivo (suplemento) - EMPEZAR AQUI
8. Graficas dashboard principal
9. Tabla variaciones
10. Comparativos
11. Pulido (responsive, dark, PDF)
