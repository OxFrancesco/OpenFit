import { expect, test } from 'bun:test';
import { metricDailyValues } from './metric-series';
import { getMetricDef } from './metric-catalog';
const day = (day, countSum) => ({
  civilStartTime: { date: { year: 2026, month: 9, day } },
  steps: { countSum },
});
test('daily rollups stay in descending civil-date order and preserve zero', () => {
  expect(
    metricDailyValues([day(1, '123'), day(3, '0'), day(2, '456')], getMetricDef('steps'))
  ).toEqual([
    { date: '2026-09-03', value: 0 },
    { date: '2026-09-02', value: 456 },
    { date: '2026-09-01', value: 123 },
  ]);
});
test('missing and invalid data are not fabricated as zero-valued days', () => {
  expect(
    metricDailyValues(
      [{ civilStartTime: { date: { year: 2026, month: 9, day: 1 } } }, day(31, '22'), {}],
      getMetricDef('steps')
    )
  ).toEqual([{ date: '2026-09-01', value: null }]);
});
test('duplicate daily entries use the metric aggregation', () => {
  const def = {
    kind: 'daily',
    field: 'reading',
    aggregate: 'avg',
    extract: (value) => value.amount,
  };
  expect(
    metricDailyValues(
      [10, 20].map((amount) => ({
        reading: { date: { year: 2026, month: 9, day: 8 }, amount },
      })),
      def
    )
  ).toEqual([{ date: '2026-09-08', value: 15 }]);
});
