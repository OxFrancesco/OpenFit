import { CardPager } from './card-pager';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { MetricCardMinHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type HealthMetric } from '@/lib/google-health';
import { type MetricDef } from '@/lib/metric-catalog';

/**
 * One dashboard metric card. Animates in/out when added or removed and
 * slides smoothly when the grid reflows around it.
 */
export function MetricCard({
  def,
  metric,
  days = 1,
}: {
  def: MetricDef;
  metric?: HealthMetric;
  days?: number;
}) {
  const theme = useTheme();
  const valueView = (value: number | null) => (
    <View style={styles.valueRow}>
      <ThemedText type="metric">
        {value === null
          ? '--'
          : value.toLocaleString(undefined, {
              maximumFractionDigits: def.fractionDigits ?? 0,
            })}
      </ThemedText>
      {def.unit.toLowerCase() !== def.label.toLowerCase() ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {def.unit}
        </ThemedText>
      ) : null}
    </View>
  );
  const daily = days > 1 ? (metric?.dailyValues ?? []) : [];
  const pages = [
    {
      id: 'range',
      value: valueView(metric?.value ?? null),
      detail:
        daily.length > 1
          ? `${days}-day ${def.aggregate === 'avg' ? 'average' : 'total'}`
          : undefined,
    },
    ...(daily.length > 1
      ? daily.map((day) => ({
          id: day.date,
          value: valueView(day.value),
          detail: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        }))
      : []),
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(18)}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      <View style={styles.headerRow}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {def.label}
        </ThemedText>
        <MetricIcon icon={def.icon} glyph={def.glyph} size={16} color={theme.textSecondary} />
      </View>

      <View style={styles.body}>
        <CardPager
          key={`${days}:${daily.map((day) => day.date).join(',')}`}
          pages={pages}
          label={`${def.label.toLowerCase()} value`}
        />

        {metric?.status === 'error' && (
          <ThemedText type="caption" style={{ color: theme.error }} numberOfLines={1}>
            {metric.error}
          </ThemedText>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.three,
    minWidth: 140,
    minHeight: MetricCardMinHeight,
    flexGrow: 1,
    flexBasis: '40%',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  body: {
    gap: Spacing.half,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
