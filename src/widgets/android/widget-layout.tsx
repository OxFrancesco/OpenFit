"use no memo";

import type { ReactNode } from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetData, WidgetSlot } from "@/lib/widget-data";
import { SECONDARY } from "./shared";
import {
  widgetPalette,
  type WidgetBackground,
  type WidgetTextTone,
} from "./widget-appearance";

export type WidgetProps = {
  data: WidgetData | null;
  widgetId?: number;
  textTone?: WidgetTextTone;
  width?: number;
  height?: number;
  background?: WidgetBackground;
};

export function WidgetFrame({
  children,
  compact = false,
  background,
  accessibilityLabel,
}: {
  accessibilityLabel?: string;
  background?: WidgetBackground;
  children: ReactNode;
  compact?: boolean;
}) {
  "use no memo";
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={accessibilityLabel ?? "Open OpenFit"}
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: widgetPalette(background).background,
        borderRadius: compact ? 22 : 28,
        padding: compact ? 8 : 12,
        flexDirection: "column",
      }}
    >
      {children}
    </FlexWidget>
  );
}

export function MetricValue({
  slot,
  size = 30,
  secondary = SECONDARY,
  compact = false,
  textShadow = {},
}: {
  slot: WidgetSlot;
  textShadow?: ReturnType<typeof widgetPalette>["textShadow"];
  size?: number;
  secondary?: `#${string}`;
  compact?: boolean;
}) {
  "use no memo";
  const unit =
    slot.unit.toLowerCase() === slot.label.toLowerCase() ? "" : slot.unit;
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={slot.label}
        maxLines={1}
        style={{
          fontSize: compact ? 10 : 12,
          color: secondary,
          ...textShadow,
          adjustsFontSizeToFit: true,
        }}
      />
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          alignItems: "flex-end",
          marginTop: compact ? 1 : 3,
        }}
      >
        <FlexWidget>
          <TextWidget
            text={slot.display}
            maxLines={1}
            style={{
              fontSize: size,
              fontWeight: "bold",
              color: slot.color,
              ...textShadow,
              adjustsFontSizeToFit: true,
            }}
          />
        </FlexWidget>
        {unit ? (
          <TextWidget
            text={unit}
            maxLines={1}
            style={{
              fontSize: compact ? 9 : 12,
              color: secondary,
              ...textShadow,
              marginLeft: 4,
              marginBottom: compact ? 2 : 4,
              adjustsFontSizeToFit: true,
            }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}
