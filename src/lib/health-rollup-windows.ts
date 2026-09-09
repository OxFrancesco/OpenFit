const FORTNIGHT_METRICS = new Set([
  'calories-in-heart-rate-zone',
  'heart-rate',
  'active-minutes',
  'total-calories',
]);

export function rollupWindows(metricId: string, start: Date, end: Date) {
  const days = FORTNIGHT_METRICS.has(metricId) ? 14 : 90;
  const windows: { start: Date; end: Date }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + days);
    if (next > end) next.setTime(end.getTime());
    windows.push({ start: cursor, end: next });
    cursor = next;
  }
  return windows;
}
