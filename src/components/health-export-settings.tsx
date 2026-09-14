import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { ThemedText } from './themed-text';
import { loadDashboardPrefs } from '@/lib/dashboard-prefs';
import { getExerciseById, listWorkoutLogs } from '@/lib/fitness-store';
import { buildHealthMarkdown, HEALTH_AI_PROMPT } from '@/lib/health-export';
import { fetchHealthSnapshot, healthSourceName, isHealthEnabled } from '@/lib/health-source';
import { getMetricDef, getDefaultGoal, METRIC_CATALOG } from '@/lib/metric-catalog';
import { supportsHealthMetric } from '@/lib/supported-health-metrics';
import { shareMarkdown } from '@/lib/share-markdown';
import type { HealthSnapshot } from '@/lib/health-data';

export function HealthExportSettings() {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportData() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const [prefs, logs, enabled] = await Promise.all([loadDashboardPrefs(), listWorkoutLogs(null), isHealthEnabled()]);
      let snapshot: HealthSnapshot | null = null;
      if (enabled) snapshot = await fetchHealthSnapshot({ days: 30, metricIds: METRIC_CATALOG.filter(m => supportsHealthMetric(m.id)).map(m => m.id) });
      const names = new Map(await Promise.all([...new Set(logs.map(log => log.exerciseId))].map(async id =>
        [id, (await getExerciseById(id))?.name ?? id] as const)));
      const createdAt = new Date().toISOString();
      const markdown = buildHealthMarkdown({
        createdAt, source: healthSourceName, snapshot,
        healthUnavailable: Platform.OS === 'web' ? 'Device health is unavailable on web. Export from your phone to include it.' : 'Device health is not connected. Connect it in Settings to include it.',
        goals: [...new Set([...prefs.rings, ...Object.keys(prefs.goals)])].flatMap(id => {
          const def = getMetricDef(id);
          return def ? [{ label: def.label, value: prefs.goals[id] ?? getDefaultGoal(id), unit: def.unit }] : [];
        }),
        workouts: logs.map(log => ({ ...log, exerciseName: names.get(log.exerciseId) ?? log.exerciseId })),
      });
      await shareMarkdown(markdown, `openfit-${createdAt.replace(/[:.]/g, '-')}.md`);
      if (!snapshot) setMessage(Platform.OS === 'web' ? 'Device health is unavailable on web. The file includes local gym logs and goals.' : 'Device health is disconnected. The file includes local gym logs and goals.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  async function copyPrompt() {
    try {
      const copied = await Clipboard.setStringAsync(HEALTH_AI_PROMPT);
      setMessage(copied ? 'Prompt copied. Attach the Markdown file in your AI chat.' : 'Could not copy the prompt. It is included in the Markdown file.');
    } catch {
      setMessage('Could not copy the prompt. It is included in the Markdown file.');
    }
  }

  return <View style={{ gap: 16 }}>
    <ThemedText type="subtitle">Export for your AI</ThemedText>
    <ThemedText type="small">Download a Markdown file with 30 days of available device health, all gym logs saved on this device, daily goals, and a ready-made prompt. Choose where to share it.</ThemedText>
    <Button mode="contained" icon="download" loading={busy} disabled={busy} onPress={exportData}>Export Markdown</Button>
    <Button mode="outlined" icon="content-copy" disabled={busy} onPress={copyPrompt}>Copy prompt</Button>
    {message && <ThemedText type="small" accessibilityRole="alert">{message}</ThemedText>}
  </View>;
}
