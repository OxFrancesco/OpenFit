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
  filled = false,
  iconSize = compact ? 14 : 20,
}: {
  widgetId?: number;
  background?: WidgetBackground;
  textTone?: WidgetTextTone;
  compact?: boolean;
  filled?: boolean;
  iconSize?: number;
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
        svg={filled
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.42l-2.34-2.33a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="m15 5 4 4M5 19l4-1 11-11a2.8 2.8 0 0 0-4-4L5 14z" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        style={{ width: iconSize, height: iconSize }}
      />
    </FlexWidget>
  );
}
