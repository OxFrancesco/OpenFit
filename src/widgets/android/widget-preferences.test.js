import { beforeEach, expect, mock, test } from "bun:test";
const entries = new Map();
mock.module("expo-secure-store", () => ({
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
} = await import("./widget-preferences");
const { widgetPalette } = await import("./widget-appearance");
beforeEach(() => entries.clear());
test("each launcher widget retains its own metric choices and text color", async () => {
  const first = {
    metrics: ["distance", "steps", "active-minutes"],
    textTone: "light",
    background: "transparent",
  };
  await saveWidgetPreferences(1, first);
  expect(await loadWidgetPreferences(1)).toEqual(first);
  expect((await loadWidgetPreferences(2)).metrics[0]).toBe("steps");
  await deleteWidgetPreferences(1);
  expect((await loadWidgetPreferences(1)).textTone).toBe("dark");
});
test("invalid stored metric ids fall back to supported defaults", async () => {
  entries.set(
    "fitty.widget.2",
    JSON.stringify({
      metrics: ["unknown", "steps", "distance"],
      editing: true,
    }),
  );
  expect((await loadWidgetPreferences(2)).metrics).toEqual([
    "steps",
    "active-energy-burned",
    "active-minutes",
  ]);
});
test("an older snapshot missing a selected metric renders a named empty slot", () => {
  const data = configureWidgetData(
    { slots: [], metricsById: {}, updatedAt: 1 },
    { metrics: ["distance", "steps", "active-minutes"], textTone: "dark" },
  );
  expect(data.slots[0]).toMatchObject({
    id: "distance",
    label: "Distance",
    display: "--",
    unit: "km",
  });
});

test("backgrounds migrate safely and remain independent per widget", async () => {
  entries.set(
    "fitty.widget.1",
    JSON.stringify({
      metrics: ["steps", "distance", "active-minutes"],
      textTone: "dark",
    }),
  );
  expect((await loadWidgetPreferences(1)).background).toBe("forest");
  const prefs = await loadWidgetPreferences(1);
  await saveWidgetPreferences(1, { ...prefs, background: "transparent" });
  expect((await loadWidgetPreferences(1)).background).toBe("transparent");
  expect((await loadWidgetPreferences(2)).background).toBe("forest");
  entries.set(
    "fitty.widget.1",
    JSON.stringify({ ...prefs, background: "invalid" }),
  );
  expect((await loadWidgetPreferences(1)).background).toBe("forest");
});

test("old inline editor state does not trap an upgraded widget in editing mode", async () => {
  entries.set(
    "fitty.widget.5",
    JSON.stringify({
      metrics: ["steps", "distance", "active-minutes"],
      editing: true,
      background: "transparent",
    }),
  );
  const prefs = await loadWidgetPreferences(5);
  expect(prefs).toEqual({
    metrics: ["steps", "distance", "active-minutes"],
    background: "transparent",
    textTone: "dark",
  });
  expect(configureWidgetData(null, prefs).slots[0].label).toBe("Steps");
});

function luminance(hex) {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("transparent text clears 4.5:1 contrast on the bright Fold wallpaper", () => {
  const palette = widgetPalette("transparent", "dark");
  for (const background of ["#C9C7DB", "#F8E3BE"]) {
    for (const color of [palette.secondary, ...palette.slotColors]) {
      const contrast =
        (luminance(background) + 0.05) / (luminance(color) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
  }
});
