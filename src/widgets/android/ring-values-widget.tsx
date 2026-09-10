"use no memo";

import {
  FlexWidget,
  OverlapWidget,
  SvgWidget,
} from "react-native-android-widget";
import { normalizeSlots, widgetSummary } from "./shared";
import { heartRingsSvg } from "./ring-svg";
import { WidgetEditButton } from "./widget-controls";
import { MetricValue, WidgetFrame, type WidgetProps } from "./widget-layout";
import { widgetPalette } from "./widget-appearance";

export function RingValuesWidget({
  data,
  widgetId,
  textTone,
  width = 220,
  height = 220,
  background,
}: WidgetProps) {
  "use no memo";
  const slots = normalizeSlots(data);
  const palette = widgetPalette(background, textTone);
  const horizontal = width > height * 1.4;
  const heartSize = Math.max(
    48,
    Math.min(
      horizontal ? width * 0.55 : width - 24,
      horizontal ? height - 24 : height - 78,
    ),
  );
  return (
    <WidgetFrame
      background={background}
      accessibilityLabel={widgetSummary(slots)}
    >
      <OverlapWidget style={{ width: "match_parent", height: "match_parent" }}>
        <FlexWidget
          style={{
            width: "match_parent",
            height: "match_parent",
            flexDirection: horizontal ? "row" : "column",
            alignItems: "center",
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              ...(horizontal
                ? { height: "match_parent" as const }
                : { width: "match_parent" as const }),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SvgWidget
              svg={heartRingsSvg(slots, heartSize)}
              style={{ width: heartSize, height: heartSize }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              ...(horizontal
                ? { flex: 1, height: "match_parent" as const }
                : { width: "match_parent" as const }),
              flexDirection: horizontal ? "column" : "row",
              marginTop: horizontal ? 0 : 8,
              justifyContent: "center",
            }}
          >
            {slots.map((slot, index) => (
              <FlexWidget
                key={index}
                style={{
                  flex: 1,
                  ...(horizontal ? { width: "match_parent" as const } : {}),
                  paddingHorizontal: 6,
                  justifyContent: "center",
                  ...(index > 0 && !horizontal
                    ? { borderLeftWidth: 1, borderLeftColor: palette.separator }
                    : {}),
                }}
              >
                <MetricValue
                  textShadow={palette.textShadow}
                  slot={slot}
                  secondary={palette.secondary}
                  compact={!horizontal && width < 270}
                  size={
                    horizontal
                      ? 25
                      : Math.min(32, Math.max(18, (width - 24) / 10))
                  }
                />
              </FlexWidget>
            ))}
          </FlexWidget>
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
