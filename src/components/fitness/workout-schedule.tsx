import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, List, Portal, Searchbar, TextInput } from 'react-native-paper';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { fetchApiJson } from '@/lib/api-base';
import { clerkAuthHeaders } from '@/lib/clerk-session';
import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/exercise-catalog';
import { searchExercises, type Exercise } from '@/lib/fitness-domain';
import { MAX_SCHEDULE_BYTES, scheduleDays, scheduleEntryKind, scheduleInputSchema, scheduleLogParams, workoutScheduleSchema, type ScheduleInput, type WorkoutSchedule } from '@/lib/workout-schedule';
import { deleteScheduleTemplate, loadScheduleLibrary, saveScheduleTemplate } from '@/lib/workout-schedule-store';

type Choice = { kind: 'replace'; index: number } | { kind: 'add' };
export function WorkoutScheduleScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; create?: string }>();
  const [id, setId] = useState(() => params.id || Crypto.randomUUID());
  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null);
  const [day, setDay] = useState('');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [attachment, setAttachment] = useState<ScheduleInput['attachment']>();
  const [operation, setOperation] = useState<'idle' | 'reading' | 'saving'>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unsaved, setUnsaved] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [newDay, setNewDay] = useState('');
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    let active = true;
    loadScheduleLibrary().then(items => {
      if (!active || params.create) return;
      const existing = params.id ? items.find(item => item.id === params.id) : items[0];
      if (existing) { setId(existing.id); setSchedule(existing.schedule); setDay(scheduleDays(existing.schedule)[0]); }
    }).catch(() => { if (active) setError('Could not load your saved schedules.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id, params.create]);
  const busy = operation !== 'idle' || loading;
  const days = schedule ? scheduleDays(schedule) : [];
  const selectedDay = day || days[0] || 'Workout A';
  const dayNotes = schedule?.dayNotes.find(item => item.day === selectedDay)?.notes ?? '';
  const persist = async (next: WorkoutSchedule) => {
    setSchedule(next); setUnsaved(true); setError('');
    if (!next.entries.length) return;
    setOperation('saving');
    try { await saveScheduleTemplate(id, next); setUnsaved(false); }
    catch { setError('Could not save on this device. Your schedule is still open; try saving again.'); }
    finally { setOperation('idle'); }
  };
  const pick = async () => {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || (asset.size ?? 0) > MAX_SCHEDULE_BYTES) throw new Error('File is too large.');
      const encoded = Platform.OS === 'web' ? asset.base64 ?? asset.uri : await new File(asset.uri).base64();
      const data = encoded.includes(',') ? encoded.slice(encoded.indexOf(',') + 1) : encoded;
      const mimeType = asset.mimeType || (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined);
      const parsed = scheduleInputSchema.parse({ attachment: { name: asset.name, mimeType, data } });
      setAttachment(parsed.attachment);
    } catch { setError('Could not open that file. Choose a JPEG, PNG, WebP, or PDF under 8 MB.'); }
  };
  const analyze = async () => {
    setOperation('reading'); setError('');
    try {
      const input = scheduleInputSchema.parse({ text, language, attachment });
      const result = await fetchApiJson<unknown>('/api/workouts/import', { method: 'POST', headers: { ...(await clerkAuthHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const next = workoutScheduleSchema.parse(result);
      setDay(scheduleDays(next)[0]);
      await persist(next);
      setAttachment(undefined); setText('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not read the schedule.'); }
    finally { setOperation('idle'); }
  };
  const select = async (exercise: Exercise) => {
    if (!schedule || !choice) return;
    const next = choice.kind === 'replace'
      ? { ...schedule, entries: schedule.entries.map((entry, index) => index === choice.index ? { ...entry, exerciseId: exercise.id } : entry) }
      : { ...schedule, entries: [...schedule.entries, { day: selectedDay, originalName: exercise.name, displayName: exercise.name, translatedName: exercise.name, kind: exercise.category, muscleGroup: exercise.primaryMuscle, prescription: '3 × 8', notes: '', exerciseId: exercise.id, confidence: 1, alternatives: [] }] };
    setChoice(null); setQuery('');
    await persist(next);
  };
  const finishEditing = async () => {
    if (!schedule) return;
    if (!schedule.title.trim() || !schedule.entries.length) { setError('Add a name and at least one exercise.'); return; }
    await persist({ ...schedule, title: schedule.title.trim() });
    setEditing(false);
  };
  return <>
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {error ? <HelperText type="error" accessibilityRole="alert">{error}</HelperText> : null}
      {!schedule ? <>
        <TextInput mode="outlined" label="Paste your gym schedule" multiline value={text} onChangeText={setText} disabled={busy} style={{ minHeight: 120 }} />
        <View style={styles.row}>
          <Button mode="outlined" icon="file-upload-outline" onPress={pick} disabled={busy}>Photo or PDF</Button>
          {attachment ? <Button onPress={() => setAttachment(undefined)} disabled={busy}>Remove file</Button> : null}
        </View>
        {attachment ? <ThemedText type="small">{attachment.name}</ThemedText> : null}
        <TextInput mode="outlined" label="Translate schedule into" value={language} onChangeText={setLanguage} disabled={busy} />
        <ThemedText type="small" style={{ color: theme.textSecondary }}>Your submitted text or file is sent to OpenRouter to read and match exercises.</ThemedText>
        <Button mode="contained" onPress={analyze} disabled={busy || (!text.trim() && !attachment) || !language.trim()} loading={operation === 'reading'}>{operation === 'reading' ? 'Reading schedule…' : 'Import schedule'}</Button>
        <Button mode="outlined" disabled={busy} onPress={() => { setSchedule({ title: 'My schedule', sourceLanguage: language, entries: [], dayNotes: [], warnings: [] }); setDay('Workout A'); setEditing(true); }}>Build manually</Button>
      </> : <>
        {editing ? <TextInput label="Schedule name" mode="outlined" value={schedule.title} onChangeText={title => { setSchedule({ ...schedule, title }); setUnsaved(true); }} maxLength={160} /> : <ThemedText type="subtitle">{schedule.title}</ThemedText>}
        <View style={styles.row}>
          <Button disabled={busy} onPress={() => editing ? void finishEditing() : setEditing(true)}>{editing ? 'Done editing' : 'Edit schedule'}</Button>
          {unsaved && !editing && schedule.entries.length ? <Button onPress={() => persist(schedule)} disabled={busy}>Retry save</Button> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[...new Set([...days, selectedDay])].map(name => <Button key={name} mode={selectedDay === name ? 'contained' : 'outlined'} onPress={() => setDay(name)} accessibilityState={{ selected: selectedDay === name }}>{name}</Button>)}
        </ScrollView>
        {dayNotes ? <ThemedText type="small" style={{ color: theme.textSecondary }}>{dayNotes}</ThemedText> : null}
        {schedule.warnings.map((warning, index) => <ThemedText key={index} type="small">{warning}</ThemedText>)}
        {schedule.entries.map((entry, index) => {
          if ((entry.day || 'Workout') !== selectedDay) return null;
          const exercise = entry.exerciseId ? getCatalogExercise(entry.exerciseId) : null;
          const strength = scheduleEntryKind(entry) === 'strength';
          return <View key={index} style={[styles.entry, { borderBottomColor: theme.textSecondary }]}>
            <ThemedText type="smallBold">{entry.displayName}</ThemedText>
            {entry.originalName !== entry.displayName ? <ThemedText type="small" style={{ color: theme.textSecondary }}>{entry.originalName}</ThemedText> : null}
            {editing ? <TextInput mode="outlined" label={`Prescription for ${entry.displayName}`} value={entry.prescription} maxLength={600} onChangeText={prescription => { setSchedule({ ...schedule, entries: schedule.entries.map((item, i) => i === index ? { ...item, prescription } : item) }); setUnsaved(true); }} /> : entry.prescription ? <ThemedText>{entry.prescription}</ThemedText> : null}
            {entry.notes ? <ThemedText type="small">{entry.notes}</ThemedText> : null}
            {strength && exercise && exercise.name.toLocaleLowerCase() !== entry.displayName.toLocaleLowerCase() ? <ThemedText type="small" style={{ color: theme.textSecondary }}>Logging as {exercise.name}</ThemedText> : null}
            {strength ? <View style={styles.row}>
              {exercise ? <Button mode="contained" disabled={busy} onPress={() => router.push({ pathname: '/log-workout', params: scheduleLogParams(entry, dayNotes) })}>Log workout</Button> : <ThemedText type="small">Choose a catalog exercise to log this movement.</ThemedText>}
              <Button disabled={busy} onPress={() => { setChoice({ kind: 'replace', index }); setQuery(''); }}>{exercise ? 'Change exercise' : 'Choose exercise'}</Button>
            </View> : null}
            {editing && schedule.entries.length > 1 ? <Button disabled={busy} onPress={() => persist({ ...schedule, entries: schedule.entries.filter((_, i) => i !== index) })}>Remove</Button> : null}
          </View>;
        })}
        {editing ? <>
          <Button mode="outlined" disabled={busy || schedule.entries.length >= 60} onPress={() => { setChoice({ kind: 'add' }); setQuery(''); }}>Add exercise</Button>
          <View style={styles.row}>
            <TextInput mode="outlined" label="New workout day" value={newDay} onChangeText={setNewDay} maxLength={100} style={{ flex: 1 }} />
            <Button disabled={!newDay.trim() || busy} onPress={() => { setDay(newDay.trim()); setNewDay(''); }}>Add day</Button>
          </View>
          <Button textColor={theme.error} disabled={busy} onPress={() => setRemoving(true)}>Delete schedule</Button>
        </> : null}
      </>}
    </ScrollView>
    <Portal>
      <Dialog visible={choice !== null} onDismiss={() => setChoice(null)}>
        <Dialog.Title>{choice?.kind === 'add' ? 'Add exercise' : 'Choose exercise'}</Dialog.Title>
        <Dialog.Content><Searchbar placeholder="Find an exercise" value={query} onChangeText={setQuery} /></Dialog.Content>
        <Dialog.ScrollArea style={{ maxHeight: 360 }}><ScrollView keyboardShouldPersistTaps="handled">
          {searchExercises(EXERCISE_CATALOG, query).slice(0, 30).map(exercise => <List.Item key={exercise.id} title={exercise.name} description={exercise.equipment} onPress={() => void select(exercise)} />)}
        </ScrollView></Dialog.ScrollArea>
        <Dialog.Actions><Button onPress={() => setChoice(null)}>Cancel</Button></Dialog.Actions>
      </Dialog>
      <Dialog visible={removing} onDismiss={() => setRemoving(false)}>
        <Dialog.Title>Delete this schedule?</Dialog.Title>
        <Dialog.Content><ThemedText>Your logged workouts will stay in History.</ThemedText></Dialog.Content>
        <Dialog.Actions><Button onPress={() => setRemoving(false)}>Cancel</Button><Button onPress={async () => {
          try { await deleteScheduleTemplate(id); setRemoving(false); router.back(); }
          catch { setRemoving(false); setError('Could not delete the schedule.'); }
        }}>Delete</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  </>;
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  entry: { gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
