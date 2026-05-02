# Suplemento - Dashboard Ejecutivo One-Pager

Anexo a SPEC_PANEL_FINANCIERO.md. Version 1.1.0.

## RUTA: /executive
Vista de UNA pantalla, sin scroll en desktop, YoY pre-calculado.
Para el director: abre y ve el estado del negocio en 5 segundos.

## DATOS
Usar /data/sadama_amadeus_executive.json. KPIs YA agregados con YoY pre-computado. NO recalcular.

interface ExecutiveData {
  meta: {generated, schema_version, description, moneda_base};
  monthly: MonthlyAggregate[];
  yoy_months: MonthlyYoY[];
  executive: {
    last_month: {yyyymm, fecha_cierre, kpis, yoy, hasYoY};
    ytd: {current_year, previous_year, fecha_corte, comparativo};
    series_12m: MonthlyAggregate[];
  };
}

interface YoYDelta {actual, anterior, delta, delta_pct}

## LAYOUT (desktop sin scroll)

HEADER  Dashboard Ejecutivo - Cierre [Mes Año] vs [Mes Año Anterior]
        [Ultimo Mes][YTD][Dark/Light][PDF]

HERO BANNER (ancho completo, ~140px)
  FLUJO TOTAL          $X,XXX,XXX
  vs [mes anterior]  $X,XXX,XXX   delta+- ($XXX) (XX.X%)   semáforo
  Color de fondo: verde-50 (delta>=+5%), ambar-50 (-5% a +5%), rojo-50 (<=-5%)

KPIs GRID 4x1
  Bancos | Inventario | CXC | CXP
  Cada uno: valor, delta+- %, sparkline 50px

GRID 2x2 GRAFICAS
  Flujo 12m (linea)         | Bancos por cuenta 12m (area)
  CXP por proveedor (donut) | YTD vs YTD anterior (barras)

ALERTAS (banda inferior, condicional)
  Solo aparece si hay variaciones criticas YoY

## COMPONENTES
- HeroFlujoBanner
- ExecKPICard (compacta)
- YoYBadge (con polaridad)
- AlertsBanner (cruza umbrales 5% y 10%, max 4)
- ExecutiveSwitch (Ultimo Mes / YTD)

## TOGGLE Ultimo Mes / YTD
Cambia fuente:
- Ultimo Mes: executive.last_month
- YTD: executive.ytd.comparativo
Layout no cambia.

## COMPORTAMIENTO
- Sin filtros (vista fija)
- Auto-refresh: si meta.generated > 24h, banner ambar
- Click en KPI navega a / con ese KPI
- PDF exporta pantalla completa

## RESPONSIVE
- Desktop ≥1280: layout completo sin scroll
- Tablet 768-1279: KPIs 2x2, graficas 2x2 con scroll
- Mobile <768: apilado

## POLARIDAD
flujo_*, bancos_total, inventario_total, cxc_total: positive (subir es bueno)
cxp_*: negative (subir es malo)
tc: neutral

## TESTS
- last_month coincide con ultimo de monthly
- YoY: nov 2026 vs nov 2025 correcto
- YTD compara mismos meses ambos años
- AlertsBanner respeta polaridad
- Hero usa rojo cuando flujo cae >5%

## ENTREGABLES
- /app/executive/page.tsx
- /components/executive/*.tsx
- /data/sadama_amadeus_executive.json
- /lib/executive.ts (loadExecutive, getPolarity, getSemaforo)
