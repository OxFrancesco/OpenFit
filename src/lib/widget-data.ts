import type { DashboardPrefs } from "@/lib/dashboard-prefs-core";
import { localDate } from "@/lib/device-health-core";
import type { HealthMetric } from "@/lib/health-data";
import {
  DEFAULT_RING_IDS,
  METRIC_CATALOG,
  getDefaultGoal,
  getMetricDef,
} from "@/lib/metric-catalog";

/**
 * Serializable snapshot of the three ring slots, rendered by the home-screen
 * widgets on both platforms. Kept free of native imports so the iOS widget
 * bundle can type-import it.
 */

/** Outer / middle / inner slot colors — mirrors SLOT_COLORS in activity-rings.tsx. */
export const WIDGET_SLOT_COLORS = ["#007AFF", "#FF3B30", "#34C759"] as const;
export const MODULAR_WIDGET_METRIC_IDS = [...DEFAULT_RING_IDS] as const;
export const WIDGET_CONFIGURABLE_METRIC_IDS = METRIC_CATALOG.map(
  (def) => def.id,
);

export type WidgetSlot = {
  id: string;
  status?: HealthMetric["status"] | "unrequested";
  label: string;
  /** Numeric value for storage; 0 when display is '--'. */
  value: number;
  /** Formatted value, '--' when the metric has no data. */
  display: string;
  unit: string;
  goal: number;
  /** Fraction of the goal clamped to 0..1; 0 when value is missing. */
  progress: number;
  color: `#${string}`;
  /** When this slot's value was read from the health store; absent for placeholders. */
  fetchedAt?: number;
  /** iOS widget-only generated outer/middle/inner heart-ring image URIs. */
  ringImageUris?: string[];
};

export type WidgetData = {
  /** Always three entries; index 0 is the outer ("primary") slot. */
  slots: WidgetSlot[];
  /** Stable fixed-metric entries for modular widgets, independent of ring order. */
  metricsById: Record<string, WidgetSlot>;
  updatedAt: number;
};

function formatValue(value: number | null, fractionDigits: number) {
  if (value === null) {
    return "--";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  });
}

export function buildWidgetData(
  prefs: DashboardPrefs,
  metrics: HealthMetric[],
): WidgetData {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const colorById = new Map<string, `#${string}`>(
    MODULAR_WIDGET_METRIC_IDS.map((id, i) => [id, WIDGET_SLOT_COLORS[i]]),
  );

  prefs.widgetMetrics.forEach((id, i) => {
    colorById.set(id, WIDGET_SLOT_COLORS[i]);
  });

  const now = Date.now();
  const createSlot = (id: string, color: `#${string}`): WidgetSlot => {
    const def = getMetricDef(id);
    const value = byId.get(id)?.value ?? null;
    const goal = prefs.goals[id] ?? getDefaultGoal(id);
    const status = byId.get(id)?.status ?? "unrequested";

    return {
      id,
      status,
      label: def?.shortLabel ?? def?.label ?? id,
      value: value ?? 0,
      display: formatValue(value, def?.fractionDigits ?? 0),
      unit: def?.unit ?? "",
      goal,
      progress:
        value !== null && goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0,
      color,
      ...(status === "loaded" || status === "empty" ? { fetchedAt: now } : {}),
    };
  };

  const slots = prefs.widgetMetrics.map((id, i) =>
    createSlot(id, WIDGET_SLOT_COLORS[i]),
  );
  const metricsById: Record<string, WidgetSlot> = {};

  for (const id of getWidgetMetricIds(prefs, { includeConfigurable: true })) {
    metricsById[id] = createSlot(id, colorById.get(id) ?? "#8E8E93");
  }

  return { slots, metricsById, updatedAt: now };
}

/**
 * Widgets show today's totals. Once the local date moves past the time a
 * summed metric was read, that value belongs to yesterday and renders as
 * '--' until the next refresh. Averages and body measurements keep their
 * last reading.
 */
export function expireStaleWidgetData<T extends WidgetData | null>(
  data: T,
  now = new Date(),
): T {
  if (!data) return data;
  const today = localDate(now);
  const expire = (slot: WidgetSlot): WidgetSlot => {
    const readAt = slot.fetchedAt ?? data.updatedAt;
    if (
      getMetricDef(slot.id)?.aggregate !== "sum" ||
      localDate(new Date(readAt)) === today
    )
      return slot;
    return { ...slot, status: "empty", value: 0, display: "--", progress: 0 };
  };
  return {
    ...data,
    slots: data.slots.map(expire),
    metricsById: Object.fromEntries(
      Object.entries(data.metricsById).map(([id, slot]) => [id, expire(slot)]),
    ),
  };
}

/** Blank slots for the signed-out / never-synced states. */
export function emptyWidgetData(prefs: DashboardPrefs): WidgetData {
  return buildWidgetData(
    prefs,
    METRIC_CATALOG.map((def) => ({
      id: def.id,
      label: def.label,
      unit: def.unit,
      value: null,
      status: "empty",
    })),
  );
}

export function mergeWidgetData(
  previous: WidgetData | null,
  incoming: WidgetData,
): WidgetData {
  const mergeSlot = (slot: WidgetSlot): WidgetSlot => {
    const saved =
      previous?.metricsById?.[slot.id] ??
      previous?.slots.find((value) => value.id === slot.id);
    if (!saved || (slot.status !== "error" && slot.status !== "unrequested"))
      return slot;
    return {
      ...saved,
      color: slot.color,
      goal: slot.goal,
      progress:
        slot.goal > 0 ? Math.min(1, Math.max(0, saved.value / slot.goal)) : 0,
    };
  };
  return {
    ...incoming,
    slots: incoming.slots.map(mergeSlot),
    metricsById: Object.fromEntries(
      Object.entries(incoming.metricsById).map(([id, slot]) => [
        id,
        mergeSlot(slot),
      ]),
    ),
  };
}

export function getWidgetMetricIds(
  prefs: DashboardPrefs,
  options: { includeConfigurable?: boolean } = {},
): string[] {
  const baseIds = options.includeConfigurable
    ? WIDGET_CONFIGURABLE_METRIC_IDS
    : MODULAR_WIDGET_METRIC_IDS;

  return [...new Set([...baseIds, ...prefs.widgetMetrics])];
}
