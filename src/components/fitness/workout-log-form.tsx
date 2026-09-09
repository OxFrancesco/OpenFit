import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
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
  type WeightUnit,
  type WorkoutLog,
} from '@/lib/fitness-domain';
import { getExerciseById, listWorkoutLogsForExercise, saveWorkoutLog } from '@/lib/fitness-store';

function parseNumber(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function displayInputNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

export function WorkoutLogForm() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const exerciseId = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [exerciseLogs, setExerciseLogs] = useState<WorkoutLog[]>([]);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(Boolean(exerciseId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!exerciseId) {
      return;
    }

    Promise.all([getExerciseById(exerciseId), listWorkoutLogsForExercise(exerciseId)])
      .then(([nextExercise, matchingLogs]) => {
        if (!active) return;
        const previous = matchingLogs[0];
        setExercise(nextExercise);
        setExerciseLogs(matchingLogs);

        if (previous) {
          setSets(String(previous.sets));
          setReps(String(previous.reps));
          setUnit(previous.enteredUnit);
          setWeight(displayInputNumber(fromKilograms(previous.weightKg, previous.enteredUnit)));
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
  }, [exerciseId]);

  const bestKg = useMemo(
    () => (exercise ? personalBestKg(exerciseLogs, exercise.id) : 0),
    [exercise, exerciseLogs],
  );

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
    if (!exercise) return;

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

    setSaving(true);
    setError(null);

    try {
      await saveWorkoutLog({
        ...input,
        exerciseId: exercise.id,
        performedAt: new Date().toISOString(),
      });
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          {loading ? (
            <ActivityIndicator accessibilityLabel="Loading exercise" style={{ marginTop: 64 }} />
          ) : exercise ? (
            <>
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
                  {bestKg > 0 ? (
                    <ThemedText type="small">Personal best {formatWeight(bestKg, unit)}</ThemedText>
                  ) : null}
                </View>
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
            Save workout
          </Button>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  scrollContent: { padding: 24, alignItems: 'center' },
  container: { width: '100%', maxWidth: 640, gap: 24 },
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
