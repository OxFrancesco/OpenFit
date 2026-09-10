import {
  getWidgetInfo,
  requestWidgetUpdateById,
  type WidgetInfo,
} from "react-native-android-widget";
import type { WidgetData } from "@/lib/widget-data";
import { refreshWidgetMetrics } from "./refresh-data";
import {
  configureWidgetData,
  loadWidgetPreferences,
  type WidgetPreferences,
} from "./widget-preferences";
import { OneValueWidget } from "./one-value-widget";
import { RingValuesWidget } from "./ring-values-widget";
import { TwoValuesWidget } from "./two-values-widget";

export const NAME_TO_WIDGET = {
  OneValue: OneValueWidget,
  TwoValues: TwoValuesWidget,
  RingValues: RingValuesWidget,
};
export const ANDROID_WIDGET_NAMES = [
  "OneValue",
  "TwoValues",
  "RingValues",
] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGET_NAMES)[number];

export function isAndroidWidgetName(name: string): name is AndroidWidgetName {
  return ANDROID_WIDGET_NAMES.some((value) => value === name);
}

export function widgetMetricCount(name: string) {
  return name === "OneValue" ? 1 : name === "TwoValues" ? 2 : 3;
}

export async function getAndroidWidgets() {
  return (
    await Promise.all(ANDROID_WIDGET_NAMES.map((name) => getWidgetInfo(name)))
  ).flat();
}

export function renderAndroidWidget(
  info: WidgetInfo,
  data: WidgetData | null,
  prefs: WidgetPreferences,
) {
  if (!isAndroidWidgetName(info.widgetName))
    throw new Error("Unsupported widget");
  const Widget = NAME_TO_WIDGET[info.widgetName];
  return (
    <Widget
      data={configureWidgetData(data, prefs)}
      widgetId={info.widgetId}
      background={prefs.background}
      textTone={prefs.textTone}
      width={info.width}
      height={info.height}
    />
  );
}

export async function updateAndroidWidget(
  info: WidgetInfo,
  data: WidgetData | null,
) {
  const prefs = await loadWidgetPreferences(info.widgetId);
  return requestWidgetUpdateById({
    widgetName: info.widgetName,
    widgetId: info.widgetId,
    renderWidget: (size) => renderAndroidWidget(size, data, prefs),
  });
}

export async function syncAndroidWidgets(data: WidgetData) {
  const widgets = await getAndroidWidgets();
  await Promise.all(widgets.map((info) => updateAndroidWidget(info, data)));
  if (!widgets.length) return;
  try {
    const configured = await Promise.all(
      widgets.map((info) => loadWidgetPreferences(info.widgetId)),
    );
    const fresh = await refreshWidgetMetrics(
      configured.flatMap((prefs, index) =>
        prefs.metrics.slice(0, widgetMetricCount(widgets[index].widgetName)),
      ),
    );
    if (fresh)
      await Promise.all(
        widgets.map((info) => updateAndroidWidget(info, fresh)),
      );
  } catch {
    // A failed refresh leaves the last successful values visible.
  }
}
