import { refreshWidgetMetrics } from './refresh-data';
import {
  configureWidgetData,
  loadWidgetPreferences,
} from './widget-preferences';
import { WidgetControls } from './widget-controls';
import {
  getWidgetInfo,
  requestWidgetUpdateById,
} from 'react-native-android-widget';

import type { WidgetData } from '@/lib/widget-data';
import { OneValueWidget } from './one-value-widget';
import { RingValuesWidget } from './ring-values-widget';
import { TwoValuesWidget } from './two-values-widget';

export const NAME_TO_WIDGET = {
  OneValue: OneValueWidget,
  TwoValues: TwoValuesWidget,
  RingValues: RingValuesWidget,
} as const;

export type AndroidWidgetName = keyof typeof NAME_TO_WIDGET;

export async function syncAndroidWidgets(data: WidgetData) {
  const names = Object.keys(NAME_TO_WIDGET) as AndroidWidgetName[];
  const widgets = (
    await Promise.all(names.map((name) => getWidgetInfo(name)))
  ).flat();
  const configured = await Promise.all(
    widgets.map(async (info) => ({
      info,
      prefs: await loadWidgetPreferences(info.widgetId),
    }))
  );
  const draw = async (values: WidgetData) =>
    Promise.all(
      configured.map(async ({ info }) => {
        const name = info.widgetName as AndroidWidgetName;
        const Widget = NAME_TO_WIDGET[name];
        const prefs = await loadWidgetPreferences(info.widgetId);
        return requestWidgetUpdateById({
          widgetName: name,
          widgetId: info.widgetId,
          renderWidget: (size) =>
            prefs.editing ? (
              <WidgetControls
                height={size.height}
                prefs={prefs}
                count={name === 'OneValue' ? 1 : name === 'TwoValues' ? 2 : 3}
              />
            ) : (
              <Widget
                data={configureWidgetData(values, prefs)}
                background={prefs.background}
                width={size.width}
                height={size.height}
              />
            ),
        });
      })
    );
  await draw(data);
  if (!configured.length) return;
  try {
    const fresh = await refreshWidgetMetrics(
      configured.flatMap(({ prefs }) => prefs.metrics)
    );
    if (fresh) await draw(fresh);
  } catch {
    // Keep the last snapshot when the provider cannot be reached.
  }
}
