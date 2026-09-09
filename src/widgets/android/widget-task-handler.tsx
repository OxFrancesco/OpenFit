import {
  WIDGET_BACKGROUNDS,
  normalizeWidgetBackground,
} from './widget-appearance';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadLastWidgetData } from '@/lib/widget-store';
import { WIDGET_CONFIGURABLE_METRIC_IDS } from '@/lib/widget-data';
import { refreshWidgetMetrics } from './refresh-data';
import { NAME_TO_WIDGET, type AndroidWidgetName } from './sync';
import {
  configureWidgetData,
  deleteWidgetPreferences,
  loadWidgetPreferences,
  saveWidgetPreferences,
} from './widget-preferences';
import { WidgetControls } from './widget-controls';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const name = props.widgetInfo.widgetName as AndroidWidgetName;
  const Widget = NAME_TO_WIDGET[name];
  if (!Widget) return;
  const id = props.widgetInfo.widgetId;
  if (props.widgetAction === 'WIDGET_DELETED') {
    await deleteWidgetPreferences(id);
    return;
  }
  const prefs = await loadWidgetPreferences(id);
  const count = name === 'OneValue' ? 1 : name === 'TwoValues' ? 2 : 3;
  if (props.widgetAction === 'WIDGET_CLICK') {
    if (props.clickAction === 'EDIT') prefs.editing = true;
    if (props.clickAction === 'BACKGROUND') {
      const current = WIDGET_BACKGROUNDS.indexOf(
        normalizeWidgetBackground(prefs.background)
      );
      prefs.background =
        WIDGET_BACKGROUNDS[(current + 1) % WIDGET_BACKGROUNDS.length];
    }
    if (props.clickAction === 'DONE') prefs.editing = false;
    if (props.clickAction === 'CHOOSE') {
      const slot = Number(props.clickActionData?.slot);
      const direction = props.clickActionData?.direction;
      if (
        !Number.isInteger(slot) ||
        slot < 0 ||
        slot >= count ||
        (direction !== 1 && direction !== -1)
      )
        return;
      const index = WIDGET_CONFIGURABLE_METRIC_IDS.indexOf(prefs.metrics[slot]);
      prefs.metrics[slot] =
        WIDGET_CONFIGURABLE_METRIC_IDS[
          (index + direction + WIDGET_CONFIGURABLE_METRIC_IDS.length) %
            WIDGET_CONFIGURABLE_METRIC_IDS.length
        ];
    }
    await saveWidgetPreferences(id, prefs);
  }
  if (prefs.editing) {
    props.renderWidget(
      <WidgetControls
        height={props.widgetInfo.height}
        prefs={prefs}
        count={count}
      />
    );
    return;
  }
  let data = await loadLastWidgetData();
  props.renderWidget(
    <Widget
      data={configureWidgetData(data, prefs)}
      background={prefs.background}
      width={props.widgetInfo.width}
      height={props.widgetInfo.height}
    />
  );
  try {
    data = await refreshWidgetMetrics(prefs.metrics.slice(0, count));
    const latest = await loadWidgetPreferences(id);
    props.renderWidget(
      latest.editing ? (
        <WidgetControls
          height={props.widgetInfo.height}
          prefs={latest}
          count={count}
        />
      ) : (
        <Widget
          data={configureWidgetData(data, latest)}
          background={latest.background}
          width={props.widgetInfo.width}
          height={props.widgetInfo.height}
        />
      )
    );
  } catch {
    // The launcher keeps the last values when a network refresh fails.
  }
}
