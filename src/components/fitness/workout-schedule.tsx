import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Searchbar, TextInput } from 'react-native-paper';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { fetchApiJson } from '@/lib/api-base';
import { clerkAuthHeaders } from '@/lib/clerk-session';
import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/exercise-catalog';
import { searchExercises } from '@/lib/fitness-domain';
import { MAX_SCHEDULE_BYTES, scheduleInputSchema, workoutScheduleSchema, type ScheduleInput, type WorkoutSchedule } from '@/lib/workout-schedule';
import { loadWorkoutSchedule, saveWorkoutSchedule } from '@/lib/workout-schedule-store';

type Operation = 'idle' | 'reading' | 'saving';
export function WorkoutScheduleScreen() {
  const theme = useTheme();
  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null);
  const [saved, setSaved] = useState(false);
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [attachment, setAttachment] = useState<ScheduleInput['attachment']>();
  const [operation, setOperation] = useState<Operation>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    loadWorkoutSchedule().then(value => { if (active) { setSchedule(value); setSaved(Boolean(value)); } })
      .catch(() => { if (active) setError('Could not load your saved schedule.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const busy = operation !== 'idle' || loading;
  const pick = async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || (asset.size ?? 0) > MAX_SCHEDULE_BYTES) throw new Error('Choose a file smaller than 8 MB.');
      let data: string;
      if (Platform.OS === 'web') {
        const encoded = asset.base64 ?? asset.uri;
        data = encoded.includes(',') ? encoded.slice(encoded.indexOf(',') + 1) : encoded;
      } else data = await new File(asset.uri).base64();
      const parsed = scheduleInputSchema.parse({ attachment: { name: asset.name, mimeType: asset.mimeType, data } });
      setAttachment(parsed.attachment);
    } catch { setError('Could not open that file. Choose a JPEG, PNG, WebP, or PDF under 8 MB.'); }
  };
  const analyze = async () => {
    setOperation('reading'); setError('');
    try {
      const input = scheduleInputSchema.parse({ text, language, attachment });
      const result = await fetchApiJson<unknown>('/api/workouts/import', { method: 'POST', headers: { ...(await clerkAuthHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      setSchedule(workoutScheduleSchema.parse(result)); setSaved(false); setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not read the schedule.'); }
    finally { setOperation('idle'); }
  };
  const select = (index: number, exerciseId: string | null) => {
    if (!schedule) return;
    setSchedule({ ...schedule, entries: schedule.entries.map((entry, i) => i === index ? { ...entry, exerciseId } : entry) });
    setSaved(false); setEditing(null); setQuery('');
  };
  const save = async () => {
    if (!schedule) return;
    setOperation('saving'); setError('');
    try { await saveWorkoutSchedule(schedule); setSaved(true); }
    catch { setError('Could not save your schedule on this device.'); }
    finally { setOperation('idle'); }
  };
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput mode="outlined" label="Paste your gym schedule" multiline value={text} onChangeText={setText} disabled={busy} style={styles.input} />
      <View style={styles.row}>
        <Button mode="outlined" icon="file-upload-outline" onPress={pick} disabled={busy}>Photo or PDF</Button>
        {attachment ? <Button onPress={() => setAttachment(undefined)} disabled={busy}>Remove file</Button> : null}
      </View>
      {attachment ? <ThemedText type="small">{attachment.name}</ThemedText> : null}
      <TextInput mode="outlined" label="Translate schedule into" value={language} onChangeText={setLanguage} disabled={busy} />
      <ThemedText type="small" style={{ color: theme.textSecondary }}>The text and file you submit are sent to OpenRouter to read, translate, and match exercises.</ThemedText>
      <Button mode="contained" onPress={analyze} disabled={busy || (!text.trim() && !attachment) || !language.trim()} loading={operation === 'reading'}>{operation === 'reading' ? 'Reading and matching…' : 'Read schedule'}</Button>
      {error ? <HelperText type="error" accessibilityRole="alert">{error}</HelperText> : null}
      {schedule ? <>
        <ThemedText type="subtitle">{schedule.title}</ThemedText>
        {schedule.warnings.map((warning, index) => <ThemedText key={index} type="small" style={{ color: theme.error }}>{warning}</ThemedText>)}
        {schedule.entries.map((entry, index) => {
          const exercise = entry.exerciseId ? getCatalogExercise(entry.exerciseId) : null;
          const previousDay = schedule.entries[index - 1]?.day;
          return <View key={index} style={styles.entry}>
            {entry.day && previousDay !== entry.day ? <ThemedText type="smallBold">{entry.day}</ThemedText> : null}
            <ThemedText type="smallBold">{entry.displayName}</ThemedText>
            {entry.originalName !== entry.displayName ? <ThemedText type="small" style={{ color: theme.textSecondary }}>{entry.originalName}</ThemedText> : null}
            {entry.prescription ? <ThemedText>{entry.prescription}</ThemedText> : null}
            {entry.notes ? <ThemedText type="small">{entry.notes}</ThemedText> : null}
            <ThemedText type="small" style={{ color: exercise ? theme.textSecondary : theme.error }}>{exercise ? `Matched to ${exercise.name}` : 'Choose an exercise. No confirmed match.'}</ThemedText>
            <View style={styles.row}>
              <Button disabled={busy} onPress={() => { setEditing(editing === index ? null : index); setQuery(''); }}>{editing === index ? 'Close choices' : 'Change exercise'}</Button>
              {exercise ? <Button mode="outlined" disabled={busy || !saved} onPress={() => router.push({ pathname: '/log-workout', params: { exerciseId: exercise.id, scheduleNotes: [entry.day, entry.originalName, entry.prescription, entry.notes].filter(Boolean).join(' · ').slice(0, 500) } })}>Log workout</Button> : null}
            </View>
            {editing === index ? <View style={styles.choices}>
              <Searchbar placeholder="Find an exercise" value={query} onChangeText={setQuery} />
              {(query ? searchExercises(EXERCISE_CATALOG, query).slice(0, 12) : entry.alternatives.flatMap(item => { const found = getCatalogExercise(item.exerciseId); return found ? [found] : []; })).map(candidate => <Button key={candidate.id} onPress={() => select(index, candidate.id)}>{candidate.name}</Button>)}
              <Button onPress={() => select(index, null)}>Leave unmatched</Button>
            </View> : null}
          </View>;
        })}
        <Button mode="contained" onPress={save} disabled={busy || saved} loading={operation === 'saving'}>{saved ? 'Schedule saved' : 'Save schedule'}</Button>
        {schedule.entries.some(entry => !entry.exerciseId) ? <ThemedText type="small">Unmatched entries stay in your schedule for later review.</ThemedText> : null}
      </> : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  input: { minHeight: 120 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entry: { gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#888' },
  choices: { gap: 4 },
});
