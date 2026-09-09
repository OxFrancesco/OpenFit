import {
  normalizeWidgetBackground,
  type WidgetBackground,
} from "./widget-appearance";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_RING_IDS,
  getDefaultGoal,
  getMetricDef,
} from "@/lib/metric-catalog";
import type { WidgetData } from "@/lib/widget-data";

export type WidgetPreferences = {
  metrics: string[];
  editing: boolean;
  background?: WidgetBackground;
};
const key = (id: number) => `fitty.widget.${id}`;

export async function loadWidgetPreferences(
  id: number,
): Promise<WidgetPreferences> {
  const raw = await SecureStore.getItemAsync(key(id));
  try {
    const value = raw ? JSON.parse(raw) : null;
    if (
      Array.isArray(value?.metrics) &&
      value.metrics.length === 3 &&
      value.metrics.every(
        (metric: unknown) => typeof metric === "string" && getMetricDef(metric),
      )
    ) {
      return {
        metrics: value.metrics,
        editing: value.editing === true,
        background: normalizeWidgetBackground(value.background),
      };
    }
  } catch {}
  return {
    metrics: [...DEFAULT_RING_IDS],
    editing: false,
    background: "forest",
  };
}

export async function saveWidgetPreferences(
  id: number,
  value: WidgetPreferences,
) {
  await SecureStore.setItemAsync(key(id), JSON.stringify(value));
}

export async function deleteWidgetPreferences(id: number) {
  await SecureStore.deleteItemAsync(key(id));
}

export function configureWidgetData(
  data: WidgetData | null,
  prefs: WidgetPreferences,
): WidgetData | null {
  if (!data) return null;
  return {
    ...data,
    slots: prefs.metrics.map((id, index) => ({
      ...(data.metricsById?.[id] ??
        data.slots.find((slot) => slot.id === id) ?? {
          id,
          label: getMetricDef(id)?.shortLabel ?? getMetricDef(id)?.label ?? id,
          value: 0,
          display: "--",
          unit: getMetricDef(id)?.unit ?? "",
          goal: getDefaultGoal(id),
          progress: 0,
        }),
      color:
        prefs.background === "light"
          ? (["#005CC5", "#B52B26", "#177D3A"] as const)[index]
          : prefs.background === "transparent"
            ? (["#74B9FF", "#FF9088", "#90E6AD"] as const)[index]
            : (["#77BAFF", "#FF8D86", "#8FDFAB"] as const)[index],
    })),
  };
}
