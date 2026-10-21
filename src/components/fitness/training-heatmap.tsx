import * as Haptics from 'expo-haptics';
import { memo, useMemo, useState } from 'react';
import {
  PixelRatio,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dateFromKey, heatmapWeeks, type DaySummary } from '@/lib/training-stats';

const GAP = 4;
const MIN_CELL = 14;
const MAX_CELL = 18;
/** Room around the grid so the outer rings of edge cells are not clipped. */
const PAD = 4;
const RING_OFFSET = 2;
const LABEL_WIDTH = 16;
const MONTH_HEIGHT = 18;
const LEVEL_OPACITY = [0, 0.32, 0.55, 0.78, 1] as const;
const WEEKDAY_LABELS = [
  { row: 0, label: 'M' },
  { row: 2, label: 'W' },
  { row: 4, label: 'F' },
] as const;

type Props = {
  days: ReadonlyMap<string, Pick<DaySummary, 'sets' | 'checkins'>>;
  now: Date;
  selected: string | null;
  onSelect: (date: string) => void;
  /** Moves the selection to the previous (-1) or next (1) active day. */
  onStep: (direction: -1 | 1) => void;
  maxWeeks?: number;
};

/** GitHub-style training calendar: one column per Monday-first week, the current week last. */
export const TrainingHeatmap = memo(function TrainingHeatmap({
  days,
  now,
  selected,
  onSelect,
  onStep,
  maxWeeks = 26,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const gridAvailable = Math.max(0, width - LABEL_WIDTH - PAD * 2);
  const weeks = Math.max(1, Math.min(maxWeeks, Math.floor((gridAvailable + GAP) / (MIN_CELL + GAP))));
  const cell = PixelRatio.roundToNearestPixel(
    Math.max(MIN_CELL, Math.min(MAX_CELL, (gridAvailable - GAP * (weeks - 1)) / weeks))
  );
  const pitch = cell + GAP;
  const radius = Math.round(cell * 0.24);
  const svgWidth = PAD * 2 + weeks * cell + (weeks - 1) * GAP;
  const svgHeight = PAD * 2 + 7 * cell + 6 * GAP;

  const columns = useMemo(() => heatmapWeeks(days, weeks, now), [days, weeks, now]);
  const activeCount = useMemo(
    () => columns.reduce((total, column) => total + column.cells.filter((item) => item.level > 0).length, 0),
    [columns]
  );
  const months = useMemo(() => monthLabels(columns.map((column) => column.weekStart)), [columns]);

  const cells = useMemo(
    () =>
      columns.flatMap((column, col) =>
        column.cells.map((item, row) =>
          item.future ? null : (
            <Rect
              key={item.date}
              x={PAD + col * pitch}
              y={PAD + row * pitch}
              width={cell}
              height={cell}
              rx={radius}
              fill={item.level === 0 ? theme.surfaceContainerHighest : theme.primary}
              fillOpacity={item.level === 0 ? 1 : LEVEL_OPACITY[item.level]}
            />
          )
        )
      ),
    [cell, columns, pitch, radius, theme.primary, theme.surfaceContainerHighest]
  );

  const position = (date: string | null) => {
    if (!date) return null;
    for (let col = 0; col < columns.length; col += 1) {
      const row = columns[col].cells.findIndex((item) => item.date === date);
      if (row >= 0) return columns[col].cells[row].future ? null : { col, row };
    }
    return null;
  };
  const todayKey = columns.flatMap((column) => column.cells).find((item) => item.today)?.date ?? null;
  const rings = [
    todayKey !== selected ? { at: position(todayKey), color: theme.primary } : null,
    { at: position(selected), color: theme.text },
  ];

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  const onPress = (event: GestureResponderEvent) => {
    const col = Math.floor((event.nativeEvent.locationX - PAD + GAP / 2) / pitch);
    const row = Math.floor((event.nativeEvent.locationY - PAD + GAP / 2) / pitch);
    const item = columns[Math.max(0, Math.min(columns.length - 1, col))]?.cells[Math.max(0, Math.min(6, row))];
    if (!item || item.future) return;
    if (item.date !== selected && process.env.EXPO_OS !== 'web') void Haptics.selectionAsync();
    onSelect(item.date);
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onStep(1);
    if (event.nativeEvent.actionName === 'decrement') onStep(-1);
  };

  const selectedLabel = selected
    ? dateFromKey(selected).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : undefined;

  return (
    <View onLayout={onLayout} style={{ minHeight: MONTH_HEIGHT + svgHeight }}>
      {width > 0 ? (
        <>
          <View
            style={[styles.months, { marginLeft: LABEL_WIDTH + PAD }]}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {months.map(({ index, label }) => (
              <ThemedText
                key={`${index}-${label}`}
                type="caption"
                style={[styles.month, { left: index * pitch, color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {label}
              </ThemedText>
            ))}
          </View>
          <View style={styles.body}>
            <View
              style={[styles.weekdays, { width: LABEL_WIDTH, height: svgHeight }]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {WEEKDAY_LABELS.map(({ row, label }) => (
                <ThemedText
                  key={label}
                  type="caption"
                  style={[
                    styles.weekday,
                    { top: PAD + row * pitch, height: cell, lineHeight: cell, color: theme.textSecondary },
                  ]}
                >
                  {label}
                </ThemedText>
              ))}
            </View>
            <Pressable
              onPress={onPress}
              accessibilityRole="adjustable"
              accessibilityLabel={`Training calendar, ${activeCount} active ${activeCount === 1 ? 'day' : 'days'} in the last ${weeks} weeks`}
              accessibilityHint="Swipe up or down to move between training days"
              accessibilityValue={selectedLabel ? { text: selectedLabel } : undefined}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={onAccessibilityAction}
              style={{ width: svgWidth, height: svgHeight }}
            >
              <Svg width={svgWidth} height={svgHeight} pointerEvents="none">
                {cells}
                {rings.map((ring, index) =>
                  ring?.at ? (
                    <Rect
                      key={index}
                      x={PAD + ring.at.col * pitch - RING_OFFSET}
                      y={PAD + ring.at.row * pitch - RING_OFFSET}
                      width={cell + RING_OFFSET * 2}
                      height={cell + RING_OFFSET * 2}
                      rx={radius + RING_OFFSET}
                      fill="none"
                      stroke={ring.color}
                      strokeWidth={1.5}
                    />
                  ) : null
                )}
              </Svg>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
});

/** One label over the first week of each month; a partial first month gives way to the next. */
function monthLabels(weekStarts: readonly string[]) {
  const labels = weekStarts.flatMap((key, index) =>
    (index === 0 || key.slice(0, 7) !== weekStarts[index - 1].slice(0, 7)) && index < weekStarts.length - 1
      ? [{ index, label: dateFromKey(key).toLocaleDateString(undefined, { month: 'short' }) }]
      : []
  );
  return labels.length > 1 && labels[0].index === 0 && labels[1].index < 3 ? labels.slice(1) : labels;
}

const styles = StyleSheet.create({
  months: {
    height: MONTH_HEIGHT,
  },
  month: {
    position: 'absolute',
    top: 0,
    width: 40,
  },
  body: {
    flexDirection: 'row',
  },
  weekdays: {
    position: 'relative',
  },
  weekday: {
    position: 'absolute',
    left: 0,
    fontSize: 10,
  },
});
