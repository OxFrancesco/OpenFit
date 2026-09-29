import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, List } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import type { ScheduleTemplate } from '@/lib/schedule-library';
import { scheduleDays } from '@/lib/workout-schedule';
import { loadScheduleLibrary } from '@/lib/workout-schedule-store';

export function ScheduleLibrary() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    loadScheduleLibrary().then(items => { if (active) { setTemplates(items); setError(''); } })
      .catch(() => { if (active) setError('Could not load saved schedules.'); });
    return () => { active = false; };
  }, []));
  return <View style={{ gap: 16 }}>
    <Button mode="contained" icon="plus" onPress={() => router.push({ pathname: '/workout-schedule', params: { create: '1' } })}>New schedule</Button>
    {error ? <HelperText type="error">{error}</HelperText> : null}
    {!templates.length && !error ? <ThemedText>Import a photo or PDF, or build your own schedule. Save it once and reuse each workout day.</ThemedText> : null}
    {templates.map(template => <List.Item key={template.id} title={template.schedule.title}
      description={scheduleDays(template.schedule).join(' · ')}
      onPress={() => router.push({ pathname: '/workout-schedule', params: { id: template.id } })}
      right={props => <List.Icon {...props} icon="chevron-right" />} />)}
  </View>;
}
