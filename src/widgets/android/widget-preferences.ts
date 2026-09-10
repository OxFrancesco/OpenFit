import {
  normalizeWidgetBackground,
  widgetPalette,
  type WidgetTextTone,
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
  textTone?: WidgetTextTone;
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
        textTone: value.textTone === "light" ? "light" : "dark",
        background: normalizeWidgetBackground(value.background),
      };
    }
  } catch {}
  return {
    metrics: [...DEFAULT_RING_IDS],
    textTone: "dark",
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
): WidgetData {
  const palette = widgetPalette(prefs.background, prefs.textTone);
  return {
    metricsById: data?.metricsById ?? {},
    updatedAt: data?.updatedAt ?? 0,
    slots: prefs.metrics.map((id, index) => ({
      ...(data?.metricsById?.[id] ??
        data?.slots.find((slot) => slot.id === id) ?? {
          id,
          label: getMetricDef(id)?.shortLabel ?? getMetricDef(id)?.label ?? id,
          value: 0,
          display: "--",
          unit: getMetricDef(id)?.unit ?? "",
          goal: getDefaultGoal(id),
          progress: 0,
        }),
      color: palette.slotColors[index % palette.slotColors.length],
    })),
  };
}
