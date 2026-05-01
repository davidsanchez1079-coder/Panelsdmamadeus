import type { DailyKpiPoint } from './dailyKpisFromRow';

export function cxpDonutFromDailyPoint(p: DailyKpiPoint | undefined | null) {
  if (!p) return [{ name: 'CXP total', value: 0 }];
  const parts = [
    { name: 'Sandvik', value: p.cxp_sandvik },
    { name: 'Vargus', value: p.cxp_vargus },
    { name: 'Mexicana', value: p.cxp_mexicana },
    { name: 'Otros', value: p.cxp_otros },
  ];
  const sumAmadeus = parts.reduce((a, b) => a + b.value, 0);
  const rest = p.cxp_total - sumAmadeus;
  const withRest =
    rest > 1 ? [...parts, { name: 'Resto (Sadama / ajuste)', value: rest }] : parts;
  const sum = withRest.reduce((a, b) => a + b.value, 0);
  return sum > 0 ? withRest : [{ name: 'CXP total', value: p.cxp_total }];
}
