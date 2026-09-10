import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { loadLastWidgetData } from "@/lib/widget-store";
import { refreshWidgetMetrics } from "./refresh-data";
import {
  isAndroidWidgetName,
  renderAndroidWidget,
  widgetMetricCount,
} from "./sync";
import {
  deleteWidgetPreferences,
  loadWidgetPreferences,
} from "./widget-preferences";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const info = props.widgetInfo;
  if (!isAndroidWidgetName(info.widgetName)) return;
  if (props.widgetAction === "WIDGET_DELETED") {
    await deleteWidgetPreferences(info.widgetId);
    return;
  }
  const prefs = await loadWidgetPreferences(info.widgetId);
  props.renderWidget(
    renderAndroidWidget(info, await loadLastWidgetData(), prefs),
  );
  try {
    const data = await refreshWidgetMetrics(
      prefs.metrics.slice(0, widgetMetricCount(info.widgetName)),
    );
    props.renderWidget(
      renderAndroidWidget(
        info,
        data,
        await loadWidgetPreferences(info.widgetId),
      ),
    );
  } catch {
    // A failed refresh leaves the last successful values visible.
  }
}
