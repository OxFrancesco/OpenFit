export const WIDGET_BACKGROUNDS = [
  "forest",
  "black",
  "light",
  "tinted",
  "transparent",
] as const;
export type WidgetBackground = (typeof WIDGET_BACKGROUNDS)[number];
export type WidgetTextTone = "dark" | "light";

export const WIDGET_BACKGROUND_LABELS = {
  forest: "Forest",
  black: "Black",
  light: "Light",
  tinted: "Tinted",
  transparent: "Transparent",
} satisfies Record<WidgetBackground, string>;

const BACKGROUND_COLORS = {
  forest: "#14201A",
  black: "#101010",
  light: "#F1F5EF",
  tinted: "#14201A99",
  transparent: "#00000000",
} satisfies Record<WidgetBackground, `#${string}`>;

export function widgetPalette(
  background: WidgetBackground = "forest",
  textTone: WidgetTextTone = "dark",
) {
  const transparent = background === "transparent";
  const darkText =
    background === "light" || (transparent && textTone === "dark");
  return {
    background: BACKGROUND_COLORS[background],
    secondary: darkText ? ("#17251C" as const) : ("#F1F6F2" as const),
    slotColors: darkText
      ? (["#004895", "#8D201D", "#125A2C"] as const)
      : (["#77BAFF", "#FF8D86", "#8FDFAB"] as const),
    textShadow: transparent
      ? {
          textShadowColor: darkText
            ? ("#FFFFFF" as const)
            : ("#000000" as const),
          textShadowRadius: 3,
          textShadowOffset: { width: 0, height: 1 },
        }
      : {},
    panel:
      background === "light"
        ? ("#E2E9E0" as const)
        : transparent
          ? ("#00000000" as const)
          : ("#FFFFFF09" as const),
    separator: darkText ? ("#17251C55" as const) : ("#FFFFFF55" as const),
  };
}

export function normalizeWidgetBackground(value: unknown): WidgetBackground {
  return (
    WIDGET_BACKGROUNDS.find((background) => background === value) ?? "forest"
  );
}
