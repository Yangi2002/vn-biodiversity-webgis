export interface ChartMetricItem {
  key: string;
  label: string;
  value: number;
  percent: number;
  color: string;
  detailUrl?: string;
  isRemainder?: boolean;
}

export const CHART_METRIC_COLORS = [
  '#1f7a4e',
  '#78b86f',
  '#d69a36',
  '#2f8f83',
  '#b65f2a',
  '#4a9b58',
  '#8f7a2f',
  '#5a7f65',
] as const;

export function metricColor(index: number): string {
  return CHART_METRIC_COLORS[index % CHART_METRIC_COLORS.length];
}

export function roundPercent(value: number, total: number): number {
  return Math.round((value / Math.max(1, total)) * 1000) / 10;
}

export function withRemainderMetric<T extends ChartMetricItem>(
  items: T[],
  total: number,
  label: string,
): ChartMetricItem[] {
  const visibleTotal = items.reduce((sum, item) => sum + item.value, 0);
  const remainderValue = Math.max(0, total - visibleTotal);

  if (remainderValue <= 0) {
    return items;
  }

  return [
    ...items,
    {
      key: `remainder-${label}`,
      label,
      value: remainderValue,
      percent: roundPercent(remainderValue, total),
      color: '#dfece5',
      isRemainder: true,
    },
  ];
}

export function donutMetricBackground(
  items: Pick<ChartMetricItem, 'value' | 'percent' | 'color'>[],
  normalizeByValue = false,
): string {
  if (!items.length) {
    return 'conic-gradient(#dcebe1 0deg 360deg)';
  }

  let cursor = 0;
  const totalValue = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  const segments = items.map((item) => {
    const start = cursor;
    const percent = normalizeByValue ? (item.value / totalValue) * 100 : item.percent;
    cursor += (percent / 100) * 360;
    return `${item.color} ${start}deg ${cursor}deg`;
  });

  if (cursor < 360) {
    segments.push(`#e3eee7 ${cursor}deg 360deg`);
  }

  return `conic-gradient(${segments.join(', ')})`;
}
