import { StyleSheet, View } from 'react-native';
import { CardPager } from './card-pager';
import { ThemedText } from './themed-text';
import { MetricCardMinHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SleepSummary } from '@/lib/google-health';

export function SleepCard({ sessions }: { sessions: SleepSummary[] }) {
  const theme = useTheme();
  const pages = sessions.length
    ? sessions.map((session) => ({
        id: session.id,
        value: <ThemedText type="metric">{formatSleepDuration(session)}</ThemedText>,
        detail: `${session.kind === 'nap' ? 'Nap' : 'Night'}${session.endTime ? ` · ${formatDateTime(session.endTime)}` : ''}`,
      }))
    : [{ id: 'empty', value: <ThemedText type="metric">--</ThemedText> }];
  return (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        Sleep
      </ThemedText>
      <CardPager key={pages.map((page) => page.id).join(',')} pages={pages} label="sleep session" />
    </View>
  );
}

function formatSleepDuration(session: SleepSummary) {
  const minutes = session.minutesAsleep ?? session.minutesInSleepPeriod;

  if (minutes === null) {
    return '--';
  }

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    minHeight: MetricCardMinHeight,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.three,
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
});
