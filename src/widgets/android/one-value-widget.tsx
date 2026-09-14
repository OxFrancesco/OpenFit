"use no memo";
import { widgetPalette } from "./widget-appearance";

import {
  FlexWidget,
  OverlapWidget,
  TextWidget,
} from "react-native-android-widget";
import { normalizeSlots, widgetSummary } from "./shared";
import { WidgetEditButton } from "./widget-controls";
import type { WidgetProps } from "./widget-layout";

export function OneValueWidget({
  data,
  widgetId,
  textTone,
  background,
  width = 80,
  height = 80,
}: WidgetProps) {
  "use no memo";
  const palette = widgetPalette(background, textTone);
  const [slot] = normalizeSlots(data);
  const side = Math.min(width, height);
  const padding = Math.round(side * 0.1);
  const iconSize = Math.round(Math.min(28, Math.max(12, side * 0.12)));
  const borderColor = background === "light" ? "#C5CEC4" : "#405247";
  const unit =
    slot.unit.toLowerCase() === slot.label.toLowerCase() ? "" : slot.unit;
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FlexWidget
        clickAction="OPEN_APP"
        accessibilityLabel={widgetSummary([slot])}
        style={{
          width: side,
          height: side,
          backgroundColor: palette.background,
          borderRadius: Math.round(side * 0.16),
          borderWidth: background === "transparent" ? 0 : 1,
          borderColor,
          paddingHorizontal: padding,
          paddingVertical: Math.round(side * 0.15),
        }}
      >
        <OverlapWidget
          style={{ width: "match_parent", height: "match_parent" }}
        >
          <FlexWidget style={{ width: "match_parent", height: "match_parent" }}>
            <TextWidget
              text={slot.label}
              maxLines={1}
              style={{
                width: "match_parent",
                paddingRight: iconSize + 6,
                fontSize: Math.min(22, Math.max(11, side * 0.12)),
                color: palette.secondary,
                ...palette.textShadow,
                adjustsFontSizeToFit: true,
              }}
            />
            <FlexWidget
              style={{
                flex: 1,
                width: "match_parent",
                justifyContent: "center",
              }}
            >
              <TextWidget
                text={slot.display}
                maxLines={1}
                style={{
                  width: "match_parent",
                  fontSize: Math.round(side * 0.46),
                  fontWeight: "bold",
                  fontStyle: "italic",
                  color: slot.color,
                  ...palette.textShadow,
                  adjustsFontSizeToFit: true,
                }}
              />
              {unit ? (
                <TextWidget
                  text={unit}
                  maxLines={1}
                  style={{
                    fontSize: Math.min(16, Math.max(10, side * 0.1)),
                    color: palette.secondary,
                    ...palette.textShadow,
                    adjustsFontSizeToFit: true,
                  }}
                />
              ) : null}
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ width: "match_parent", alignItems: "flex-end" }}>
            <WidgetEditButton
              widgetId={widgetId}
              background={background}
              textTone={textTone}
              compact
              filled
              iconSize={iconSize}
            />
          </FlexWidget>
        </OverlapWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
