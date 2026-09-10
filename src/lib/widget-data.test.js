import { expect, test } from "bun:test";
import { defaultPrefs } from "./dashboard-prefs-core";
import {
  buildWidgetData,
  emptyWidgetData,
  mergeWidgetData,
} from "./widget-data";

const prefs = defaultPrefs();
const loaded = (id, value) => ({ id, value, status: "loaded" });

test("failed refreshes preserve the last successful widget values", () => {
  const saved = buildWidgetData(prefs, [
    loaded("steps", 538),
    loaded("active-energy-burned", 52),
  ]);
  const failed = buildWidgetData(prefs, [
    { id: "steps", value: null, status: "error" },
  ]);
  const result = mergeWidgetData(saved, failed);
  expect(result.slots[0].display).toBe("538");
  expect(result.metricsById["active-energy-burned"].display).toBe("52");
});

test("partial refreshes update requested metrics without clearing other widget choices", () => {
  const saved = buildWidgetData(prefs, [
    loaded("steps", 538),
    loaded("distance", 0.4),
  ]);
  const result = mergeWidgetData(
    saved,
    buildWidgetData(prefs, [loaded("steps", 620)]),
  );
  expect(result.slots[0].display).toBe("620");
  expect(result.metricsById.distance.display).toBe("0.4");
});

test("a successful empty response clears a previous value", () => {
  const saved = buildWidgetData(prefs, [loaded("steps", 538)]);
  const result = mergeWidgetData(
    saved,
    buildWidgetData(prefs, [{ id: "steps", value: null, status: "empty" }]),
  );
  expect(result.slots[0].display).toBe("--");
});

test("signing out clears all retained metric values", () => {
  const saved = buildWidgetData(prefs, [
    loaded("steps", 538),
    loaded("distance", 0.4),
  ]);
  const result = mergeWidgetData(saved, emptyWidgetData(prefs));
  expect(
    Object.values(result.metricsById).every((slot) => slot.display === "--"),
  ).toBe(true);
});
