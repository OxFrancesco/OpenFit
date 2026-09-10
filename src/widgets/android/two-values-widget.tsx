"use no memo";
import { widgetPalette } from "./widget-appearance";

import { FlexWidget, OverlapWidget } from "react-native-android-widget";
import { normalizeSlots, widgetSummary } from "./shared";
import { WidgetEditButton } from "./widget-controls";
import { MetricValue, WidgetFrame, type WidgetProps } from "./widget-layout";

export function TwoValuesWidget({
  data,
  widgetId,
  textTone,
  background,
  width = 180,
  height = 180,
}: WidgetProps) {
  "use no memo";
  const palette = widgetPalette(background, textTone);
  const slots = normalizeSlots(data).slice(0, 2);
  const horizontal = width > height * 1.6;
  return (
    <WidgetFrame
      background={background}
      accessibilityLabel={widgetSummary(slots)}
    >
      <OverlapWidget style={{ width: "match_parent", height: "match_parent" }}>
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            flexDirection: horizontal ? "row" : "column",
            flexGap: 0,
          }}
        >
          {slots.map((slot, index) => (
            <FlexWidget
              key={index}
              style={{
                flex: 1,
                ...(horizontal ? {} : { width: "match_parent" as const }),
                justifyContent: "center",
                ...(index === 0
                  ? horizontal
                    ? {
                        borderRightWidth: 1,
                        borderRightColor: palette.separator,
                      }
                    : {
                        borderBottomWidth: 1,
                        borderBottomColor: palette.separator,
                      }
                  : {}),
                paddingHorizontal: horizontal ? 8 : 0,
                paddingVertical: height < 180 ? 2 : 8,
              }}
            >
              <MetricValue
                textShadow={palette.textShadow}
                compact={height < 180}
                secondary={palette.secondary}
                slot={slot}
                size={
                  height < 180
                    ? 22
                    : Math.min(48, Math.max(30, width / (horizontal ? 7 : 4.8)))
                }
              />
            </FlexWidget>
          ))}
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", alignItems: "flex-end" }}>
          <WidgetEditButton
            widgetId={widgetId}
            background={background}
            textTone={textTone}
          />
        </FlexWidget>
      </OverlapWidget>
    </WidgetFrame>
  );
}
