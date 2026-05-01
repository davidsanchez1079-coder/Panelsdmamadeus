export type Granularity = 'day' | 'week' | 'month' | 'year';

export type Domain = 'sadama' | 'amadeus' | 'consolidated';

export type Currency = 'MXN' | 'USD';

export interface JsonMeta {
  generated?: string;
  source?: string;
  schema_version?: string;
  fecha_format?: string;
  moneda_base?: Currency | string;
  warnings_count?: number;
  warnings?: string[];
  description?: string;
}

export interface DatosRow {
  _row: number;
  fecha: string; // ISO YYYY-MM-DD
  sadama: {
    banco: number;
    inventarios: number;
    cxc: number;
    cxp: number;
    fact_dia_mes: number;
  };
  amadeus: {
    inventarios: number;
    cxc: number;
    fact_dia_mes: number;
    compras_mes: number;
    cxp: {
      sandvik: number;
      vargus: number;
      mexicana: number;
      otros: number;
    };
    bancos: {
      bajio_usd: number;
      bajio_mxn: number;
      hsbc: number;
    };
  };
  tc: number;
}

export interface AnalisisRow extends DatosRow {
  total_cxp_amadeus: number;
  total_bancos_amadeus: number;
  flujos: { sadama: number; amadeus: number; total: number };
  totales: { bancos: number; inventario: number; cxc: number; cxp: number };
  dif_flujo_total?: number;
  dif_bancos_total?: number;
  dif_inventario_total?: number;
  dif_cxc_total?: number;
  dif_cxp_total?: number;
}

export interface SadamaAmadeusV1 {
  meta: JsonMeta;
  datos: {
    description?: string;
    count: number;
    rango?: { min: string; max: string };
    rows: DatosRow[];
  };
  analisis: {
    description?: string;
    count: number;
    rango?: { min: string; max: string };
    rows: AnalisisRow[];
  };
}

