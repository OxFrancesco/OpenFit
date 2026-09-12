import { expect, test } from "bun:test";
import { defaultPrefs } from "./dashboard-prefs-core";
import {
  buildWidgetData,
  emptyWidgetData,
  expireStaleWidgetData,
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

/** Pretend `data` was read at `time` instead of now. */
function readAt(data, time) {
  const stamp = (slot) => (slot.fetchedAt ? { ...slot, fetchedAt: time } : slot);
  return {
    ...data,
    updatedAt: time,
    slots: data.slots.map(stamp),
    metricsById: Object.fromEntries(Object.entries(data.metricsById).map(([id, slot]) => [id, stamp(slot)])),
  };
}

test("yesterday's totals do not pose as today's after local midnight", () => {
  const yesterday = new Date(2026, 8, 11, 22, 30);
  const today = new Date(2026, 8, 12, 0, 5);
  const data = readAt(
    buildWidgetData(prefs, [loaded("steps", 12_340), loaded("weight", 71.2)]),
    yesterday.getTime(),
  );
  expect(expireStaleWidgetData(data, yesterday).slots[0].display).toBe("12,340");
  const expired = expireStaleWidgetData(data, today);
  expect(expired.slots[0]).toMatchObject({ display: "--", value: 0, progress: 0 });
  expect(expired.metricsById.steps.display).toBe("--");
  expect(expired.metricsById.weight.display).toBe("71.2");
});

test("a metric refreshed today survives expiry even when the snapshot is older", () => {
  const yesterday = new Date(2026, 8, 11, 22, 30).getTime();
  const today = new Date(2026, 8, 12, 9, 0);
  const saved = readAt(buildWidgetData(prefs, [loaded("steps", 12_340), loaded("distance", 4.2)]), yesterday);
  const merged = mergeWidgetData(
    saved,
    readAt(buildWidgetData(prefs, [loaded("steps", 800), { id: "distance", value: null, status: "error" }]), today.getTime()),
  );
  const expired = expireStaleWidgetData(merged, today);
  expect(expired.metricsById.steps.display).toBe("800");
  expect(expired.metricsById.distance.display).toBe("--");
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
