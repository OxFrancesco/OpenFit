import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, List, RadioButton } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ScheduleTemplate } from '@/lib/schedule-library';
import { syncTrainingWidgets } from '@/lib/training-widget-sync';
import { scheduleDays } from '@/lib/workout-schedule';
import { loadActiveScheduleId, loadScheduleLibrary, saveActiveScheduleId } from '@/lib/workout-schedule-store';

export function ScheduleLibrary() {
  const theme = useTheme();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([loadScheduleLibrary(), loadActiveScheduleId()])
      .then(([items, storedId]) => {
        if (!active) return;
        setTemplates(items);
        setActiveId(items.some(item => item.id === storedId) ? storedId : items[0]?.id ?? null);
        setError('');
      })
      .catch(() => { if (active) setError('Could not load saved schedules.'); });
    return () => { active = false; };
  }, []));
  const follow = async (id: string) => {
    if (id === activeId) return;
    const previous = activeId;
    setActiveId(id);
    setError('');
    try {
      await saveActiveScheduleId(id);
      void syncTrainingWidgets().catch(() => undefined);
    } catch {
      setActiveId(previous);
      setError('Could not change the plan Today follows.');
    }
  };
  const newSchedule = <Button mode={templates.length ? 'outlined' : 'contained'} icon="plus" contentStyle={{ minHeight: 48 }}
    onPress={() => router.push('/workout-schedule?create=1' as Href)}>New schedule</Button>;
  return <View style={{ gap: 16 }}>
    {templates.length ? null : newSchedule}
    {error ? <HelperText type="error" accessibilityRole="alert">{error}</HelperText> : null}
    {!templates.length && !error ? <ThemedText style={{ color: theme.textSecondary }}>Import a plan from a photo, PDF or text, or build your own.</ThemedText> : null}
    <RadioButton.Group value={activeId ?? ''} onValueChange={id => void follow(id)}>
      {templates.map(template => <View key={template.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
        {templates.length > 1 ? <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <RadioButton.Android value={template.id} accessibilityLabel={`Follow ${template.schedule.title} on Today`}
            hitSlop={6} />
        </View> : null}
        <List.Item title={template.schedule.title}
          description={scheduleDays(template.schedule).join(' · ')}
          descriptionNumberOfLines={2}
          style={{ flex: 1, minHeight: 64, justifyContent: 'center' }}
          onPress={() => router.push(`/workout-schedule?id=${encodeURIComponent(template.id)}` as Href)}
          right={props => <List.Icon {...props} icon="chevron-right" />} />
      </View>)}
    </RadioButton.Group>
    {templates.length ? newSchedule : null}
  </View>;
}
