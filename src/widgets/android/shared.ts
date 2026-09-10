import type { WidgetData, WidgetSlot } from "@/lib/widget-data";

export const CARD_BACKGROUND = "#14201A";
export const SECONDARY = "#ABB9AF";

export const PLACEHOLDER_SLOT: WidgetSlot = {
  id: "",
  label: "OpenFit",
  value: 0,
  display: "--",
  unit: "",
  goal: 0,
  progress: 0,
  color: SECONDARY,
};

/** Renders may run before the first sync — always provide three safe slots. */
export function normalizeSlots(
  data: WidgetData | null | undefined,
): [WidgetSlot, WidgetSlot, WidgetSlot] {
  const slots = data?.slots ?? [];
  return [
    slots[0] ?? PLACEHOLDER_SLOT,
    slots[1] ?? PLACEHOLDER_SLOT,
    slots[2] ?? PLACEHOLDER_SLOT,
  ];
}

export function widgetSummary(slots: WidgetSlot[]) {
  return (
    slots
      .map(
        (slot) =>
          `${slot.label}: ${slot.display}${slot.unit && slot.unit.toLowerCase() !== slot.label.toLowerCase() ? ` ${slot.unit}` : ""}`,
      )
      .join(", ") + ". Open OpenFit"
  );
}
