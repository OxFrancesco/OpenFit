import { expect, test } from 'bun:test';
import { rollupWindows } from './health-rollup-windows';
test('restricted metrics split a thirty-day range into adjacent supported requests', () => {
  const windows = rollupWindows('active-minutes', new Date(2026, 8, 1), new Date(2026, 9, 1));
  expect(windows.map((window) => [window.start.getDate(), window.end.getDate()])).toEqual([
    [1, 15],
    [15, 29],
    [29, 1],
  ]);
  expect(
    windows.every(
      (window, index) => index === 0 || window.start.getTime() === windows[index - 1].end.getTime()
    )
  ).toBe(true);
});
test('weekly requests and unrestricted ninety-day requests remain single calls', () => {
  expect(rollupWindows('heart-rate', new Date(2026, 8, 1), new Date(2026, 8, 8))).toHaveLength(1);
  expect(rollupWindows('steps', new Date(2026, 6, 1), new Date(2026, 8, 29))).toHaveLength(1);
});
