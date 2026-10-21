import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  SegmentedButtons,
  TextInput,
} from 'react-native-paper';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  formatWeight,
  fromKilograms,
  personalBestKg,
  toKilograms,
  validateWorkoutInput,
  type Exercise,
  type ScheduleLink,
  type WeightUnit,
  type WorkoutLog,
} from '@/lib/fitness-domain';
import {
  deleteWorkoutLog,
  getExerciseById,
  getWorkoutLog,
  listWorkoutLogsForExercise,
  saveWorkoutLog,
} from '@/lib/fitness-store';
import { syncTrainingWidgets } from '@/lib/training-widget-sync';

type LogParams = {
  exerciseId?: string | string[];
  logId?: string | string[];
  scheduleId?: string | string[];
  scheduleDay?: string | string[];
  entryKey?: string | string[];
  plannedSets?: string | string[];
  plannedReps?: string | string[];
  plannedWeightKg?: string | string[];
  plannedUnit?: string | string[];
  prescription?: string | string[];
  scheduleNotes?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim() ? text : undefined;
}

function parsePlannedCount(value: string | undefined, max: number) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= max ? String(count) : undefined;
}

function parsePlannedWeightKg(value: string | undefined) {
  if (!value) return undefined;
  const kilograms = Number(value);
  return Number.isFinite(kilograms) && kilograms >= 0 && kilograms <= 1_000 ? kilograms : undefined;
}

function parseNumber(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function displayInputNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

function closeForm() {
  if (router.canGoBack()) router.back();
  else router.replace('/fitness');
}

export function WorkoutLogForm() {
  const theme = useTheme();
  const params = useLocalSearchParams<LogParams>();
  const exerciseId = firstParam(params.exerciseId);
  const logId = firstParam(params.logId);
  const scheduleId = firstParam(params.scheduleId);
  const scheduleDay = firstParam(params.scheduleDay);
  const entryKey = firstParam(params.entryKey);
  // A bare "3×10" only repeats the sets and reps fields below it.
  const prescription = firstParam(params.prescription)?.trim().slice(0, 600).replace(/^\d{1,2}\s*[x×]\s*\d{1,3}$/i, '');
  const scheduleNotes = firstParam(params.scheduleNotes);
  const plannedSets = parsePlannedCount(firstParam(params.plannedSets), 99);
  const plannedReps = parsePlannedCount(firstParam(params.plannedReps), 999);
  const plannedWeightKg = parsePlannedWeightKg(firstParam(params.plannedWeightKg));
  const plannedUnitParam = firstParam(params.plannedUnit);
  const plannedUnit: WeightUnit | undefined =
    plannedUnitParam === 'kg' || plannedUnitParam === 'lb' ? plannedUnitParam : undefined;
  const fromPlan = Boolean(plannedSets || plannedReps || plannedWeightKg !== undefined);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<WorkoutLog[]>([]);
  const [original, setOriginal] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState(plannedSets ?? '3');
  const [reps, setReps] = useState(plannedReps ?? '8');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>(plannedUnit ?? 'kg');
  const [notes, setNotes] = useState(() => (scheduleNotes ?? '').slice(0, 500));
  const [focusWeight, setFocusWeight] = useState(false);
  const [loading, setLoading] = useState(Boolean(logId || exerciseId));
  const [saving, setSaving] = useState(false);
  // The keyboard's done key and the Save button can both fire before `saving` renders.
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!logId && !exerciseId) {
      return;
    }

    const load = async () => {
      const editing = logId ? await getWorkoutLog(logId) : null;
      if (logId && !editing) throw new Error('This entry no longer exists.');
      const id = editing?.exerciseId ?? exerciseId ?? '';
      const [nextExercise, matchingLogs] = await Promise.all([
        getExerciseById(id),
        listWorkoutLogsForExercise(id),
      ]);
      return { editing, nextExercise, matchingLogs };
    };

    load()
      .then(({ editing, nextExercise, matchingLogs }) => {
        if (!active) return;
        setExercise(nextExercise);
        setExerciseLogs(matchingLogs);
        setOriginal(editing);

        if (editing) {
          setSets(String(editing.sets));
          setReps(String(editing.reps));
          setUnit(editing.enteredUnit);
          setWeight(displayInputNumber(fromKilograms(editing.weightKg, editing.enteredUnit)));
          setNotes(editing.notes);
        } else {
          const previous = matchingLogs[0];
          const nextUnit = plannedUnit ?? previous?.enteredUnit ?? 'kg';
          const weightKg = plannedWeightKg ?? previous?.weightKg;
          setSets(plannedSets ?? (previous ? String(previous.sets) : '3'));
          setReps(plannedReps ?? (previous ? String(previous.reps) : '8'));
          setUnit(nextUnit);
          setWeight(weightKg === undefined ? '' : displayInputNumber(fromKilograms(weightKg, nextUnit)));
          setFocusWeight(weightKg === undefined && nextExercise?.equipment !== 'Bodyweight');
        }

        if (!nextExercise) setError('This exercise is no longer in the catalog.');
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logId, exerciseId, plannedSets, plannedReps, plannedWeightKg, plannedUnit]);

  const bestKg = useMemo(
    () => (exercise ? personalBestKg(exerciseLogs, exercise.id) : 0),
    [exercise, exerciseLogs],
  );
  const previous = original ? null : exerciseLogs[0] ?? null;

  const changeUnit = (nextUnit: WeightUnit) => {
    if (nextUnit === unit) return;
    const parsedWeight = parseNumber(weight);
    if (Number.isFinite(parsedWeight)) {
      const kilograms = toKilograms(parsedWeight, unit);
      setWeight(displayInputNumber(fromKilograms(kilograms, nextUnit)));
    }
    setUnit(nextUnit);
  };

  const save = async () => {
    if (!exercise || savingRef.current) return;

    const parsedSets = parseNumber(sets);
    const parsedReps = parseNumber(reps);
    const parsedWeight = parseNumber(weight || '0');
    const weightKg = toKilograms(parsedWeight, unit);
    const input = {
      sets: parsedSets,
      reps: parsedReps,
      weightKg,
      enteredUnit: unit,
      notes: notes.trim(),
    };
    const validationError = validateWorkoutInput(input);

    if (validationError) {
      setError(validationError);
      return;
    }

    const link: ScheduleLink | null = original
      ? original.schedule ?? null
      : scheduleId && scheduleDay && entryKey
        ? { scheduleId, scheduleDay, entryKey }
        : null;

    savingRef.current = true;
    setSaving(true);
    setError(null);

    try {
      await saveWorkoutLog({
        ...input,
        id: original?.id,
        exerciseId: exercise.id,
        performedAt: original?.performedAt ?? new Date().toISOString(),
        schedule: link,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      void syncTrainingWidgets().catch(() => undefined);
      closeForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!original) return;
    setSaving(true);
    setError(null);

    try {
      await deleteWorkoutLog(original.id);
      void syncTrainingWidgets().catch(() => undefined);
      closeForm();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    if (!original || !exercise) return;
    const message = `Delete ${exercise.name}, ${original.sets} × ${original.reps}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void remove();
      return;
    }
    Alert.alert('Delete entry?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior="padding"
      keyboardVerticalOffset={88}
    >
      {logId ? <Stack.Screen options={{ title: 'Edit entry' }} /> : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator accessibilityLabel="Loading exercise" style={{ marginTop: 64 }} />
          ) : exercise ? (
            <>
              <View style={styles.headerBlock}>
                <View style={[styles.exerciseHeader, { backgroundColor: theme.secondaryContainer }]}>
                  <MetricIcon
                    icon="dumbbell.fill"
                    glyph=""
                    size={32}
                    color={theme.onSecondaryContainer}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <ThemedText type="subtitle" style={{ color: theme.onSecondaryContainer }}>
                      {exercise.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.onSecondaryContainer }}>
                      {exercise.primaryMuscle} · {exercise.equipment}
                    </ThemedText>
                    {previous && fromPlan ? (
                      <ThemedText type="small" style={{ color: theme.onSecondaryContainer }}>
                        Last time {previous.sets} × {previous.reps}
                        {previous.weightKg > 0 ? ` · ${formatWeight(previous.weightKg, previous.enteredUnit)}` : ''}
                      </ThemedText>
                    ) : null}
                    {bestKg > 0 ? (
                      <ThemedText type="small" style={{ color: theme.onSecondaryContainer }}>
                        PR {formatWeight(bestKg, unit)}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                {prescription ? (
                  <ThemedText
                    type="small"
                    accessibilityLabel={`Planned ${prescription}`}
                    style={{ color: theme.textSecondary, paddingHorizontal: 8 }}
                  >
                    {prescription}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.fieldGrid}>
                <TextInput
                  mode="outlined"
                  label="Sets"
                  accessibilityLabel="Sets"
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  selectTextOnFocus
                  style={styles.numberField}
                />
                <TextInput
                  mode="outlined"
                  label="Reps"
                  accessibilityLabel="Reps"
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  selectTextOnFocus
                  style={styles.numberField}
                />
              </View>
              <View style={styles.weightRow}>
                <TextInput
                  mode="outlined"
                  label={exercise.equipment === 'Bodyweight' ? 'Added weight' : 'Weight'}
                  accessibilityLabel={`Weight in ${unit}`}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  selectTextOnFocus
                  autoFocus={focusWeight}
                  returnKeyType="done"
                  onSubmitEditing={() => void save()}
                  style={{ flex: 1 }}
                  right={<TextInput.Affix text={unit} />}
                />
                <SegmentedButtons
                  value={unit}
                  onValueChange={(value) => {
                    if (value === 'kg' || value === 'lb') changeUnit(value);
                  }}
                  buttons={[
                    { value: 'kg', label: 'kg' },
                    { value: 'lb', label: 'lb' },
                  ]}
                  style={{ width: 144 }}
                />
              </View>
              <TextInput
                mode="outlined"
                label="Notes, optional"
                accessibilityLabel="Workout notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Form, tempo or machine setting"
                multiline
                numberOfLines={4}
                maxLength={500}
                style={{ minHeight: 120 }}
              />
            </>
          ) : (
            <ThemedText accessibilityRole="alert" style={{ color: theme.error }}>
              {error ?? 'Exercise not found.'}
            </ThemedText>
          )}
          {exercise && error ? (
            <HelperText type="error" visible accessibilityRole="alert">
              {error}
            </HelperText>
          ) : null}
          {original ? (
            <Button
              mode="text"
              textColor={theme.error}
              disabled={saving}
              onPress={confirmRemove}
              contentStyle={{ minHeight: 48 }}
              style={{ alignSelf: 'flex-start' }}
            >
              Delete entry
            </Button>
          ) : null}
        </View>
      </ScrollView>
      {exercise ? (
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="check"
            loading={saving}
            disabled={saving}
            onPress={() => void save()}
            accessibilityLabel={`Save ${exercise.name} entry`}
            contentStyle={{ minHeight: 56 }}
          >
            {original ? 'Save changes' : 'Save'}
          </Button>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scrollContent: { padding: 24, alignItems: 'center' },
  container: { width: '100%', maxWidth: 640, gap: 24 },
  headerBlock: { gap: 12 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderRadius: 28,
    padding: 24,
  },
  fieldGrid: { flexDirection: 'row', gap: 16 },
  numberField: { flex: 1 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actions: { width: '100%', maxWidth: 688, alignSelf: 'center', padding: 24, paddingBottom: 32 },
});
