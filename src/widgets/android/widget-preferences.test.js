import { beforeEach, expect, mock, test } from 'bun:test';
const entries = new Map();
mock.module('expo-secure-store', () => ({
  getItemAsync: async (key) => entries.get(key) ?? null,
  setItemAsync: async (key, value) => {
    entries.set(key, value);
  },
  deleteItemAsync: async (key) => {
    entries.delete(key);
  },
}));
const {
  configureWidgetData,
  loadWidgetPreferences,
  saveWidgetPreferences,
  deleteWidgetPreferences,
} = await import('./widget-preferences');
beforeEach(() => entries.clear());
test('each launcher widget retains its own metric choices and edit state', async () => {
  const first = {
    metrics: ['distance', 'steps', 'active-minutes'],
    editing: true,
    background: 'transparent',
  };
  await saveWidgetPreferences(1, first);
  expect(await loadWidgetPreferences(1)).toEqual(first);
  expect((await loadWidgetPreferences(2)).metrics[0]).toBe('steps');
  await deleteWidgetPreferences(1);
  expect((await loadWidgetPreferences(1)).editing).toBe(false);
});
test('invalid stored metric ids fall back to supported defaults', async () => {
  entries.set(
    'fitty.widget.2',
    JSON.stringify({ metrics: ['unknown', 'steps', 'distance'], editing: true })
  );
  expect((await loadWidgetPreferences(2)).metrics).toEqual([
    'steps',
    'active-energy-burned',
    'active-minutes',
  ]);
});
test('an older snapshot missing a selected metric renders a named empty slot', () => {
  const data = configureWidgetData(
    { slots: [], metricsById: {}, updatedAt: 1 },
    { metrics: ['distance', 'steps', 'active-minutes'], editing: false }
  );
  expect(data.slots[0]).toMatchObject({
    id: 'distance',
    label: 'Distance',
    display: '--',
    unit: 'km',
  });
});

test('backgrounds migrate safely and remain independent per widget', async () => {
  entries.set(
    'fitty.widget.1',
    JSON.stringify({
      metrics: ['steps', 'distance', 'active-minutes'],
      editing: false,
    })
  );
  expect((await loadWidgetPreferences(1)).background).toBe('forest');
  const prefs = await loadWidgetPreferences(1);
  await saveWidgetPreferences(1, { ...prefs, background: 'transparent' });
  expect((await loadWidgetPreferences(1)).background).toBe('transparent');
  expect((await loadWidgetPreferences(2)).background).toBe('forest');
  entries.set(
    'fitty.widget.1',
    JSON.stringify({ ...prefs, background: 'invalid' })
  );
  expect((await loadWidgetPreferences(1)).background).toBe('forest');
});
