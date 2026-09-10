"use no memo";

import { FlexWidget, SvgWidget } from "react-native-android-widget";
import {
  widgetPalette,
  type WidgetBackground,
  type WidgetTextTone,
} from "./widget-appearance";

export function WidgetEditButton({
  widgetId,
  background,
  textTone,
  compact = false,
}: {
  widgetId?: number;
  background?: WidgetBackground;
  textTone?: WidgetTextTone;
  compact?: boolean;
}) {
  "use no memo";
  const color = widgetPalette(background, textTone).secondary;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `fitty://widget-settings?id=${widgetId ?? ""}` }}
      accessibilityLabel="Customize this widget"
      style={{
        width: 48,
        height: 48,
        justifyContent: compact ? "flex-start" : "center",
        alignItems: compact ? "flex-end" : "center",
      }}
    >
      <SvgWidget
        svg={`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="m15 5 4 4M5 19l4-1 11-11a2.8 2.8 0 0 0-4-4L5 14z" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        style={{ width: compact ? 14 : 20, height: compact ? 14 : 20 }}
      />
    </FlexWidget>
  );
}
