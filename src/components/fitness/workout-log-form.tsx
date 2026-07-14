import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MetricIcon } from '@/components/metric-icon';
import { ThemedText } from '@/components/themed-text';
import { ErrorRed, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
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
import {
  getExerciseById,
  listWorkoutLogsForExercise,
  saveWorkoutLog,
} from '@/lib/fitness-store';

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
    [exercise, exerciseLogs]
  );

  const preview = useMemo(() => {
    const parsedSets = parseNumber(sets);
    const parsedReps = parseNumber(reps);
    const parsedWeight = parseNumber(weight || '0');
    if (![parsedSets, parsedReps, parsedWeight].every(Number.isFinite)) return null;
    return {
      sets: parsedSets,
      reps: parsedReps,
      weight: parsedWeight,
      volumeKg: parsedSets * parsedReps * toKilograms(parsedWeight, unit),
    };
  }, [reps, sets, unit, weight]);

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
      keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {loading ? (
            <View style={styles.loading}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Loading exercise…
              </ThemedText>
            </View>
          ) : exercise ? (
            <>
              <Animated.View entering={FadeInDown.duration(280)} style={styles.exerciseHeader}>
                <View style={[styles.exerciseIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <MetricIcon icon="dumbbell.fill" glyph="◆" size={24} color={theme.text} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="subtitle">{exercise.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {exercise.primaryMuscle} · {exercise.equipment}
                  </ThemedText>
                  {bestKg ? (
                    <ThemedText selectable type="caption" style={{ color: theme.textSecondary }}>
                      Personal best: {formatWeight(bestKg, unit)}
                    </ThemedText>
                  ) : null}
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(60).duration(280)}
                style={[styles.formCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.fieldGrid}>
                  <NumberField label="SETS" value={sets} onChangeText={setSets} />
                  <NumberField label="REPS" value={reps} onChangeText={setReps} />
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                      WEIGHT
                    </ThemedText>
                    <View style={[styles.unitControl, { backgroundColor: theme.backgroundSelected }]}>
                      {(['kg', 'lb'] as const).map((item) => {
                        const selected = unit === item;
                        return (
                          <Pressable
                            key={item}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            onPress={() => changeUnit(item)}
                            style={({ pressed }) => [
                              styles.unitButton,
                              selected && { backgroundColor: theme.text },
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText
                              type="smallBold"
                              style={{ color: selected ? theme.background : theme.textSecondary }}
                            >
                              {item}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <TextInput
                    accessibilityLabel={`Weight in ${unit}`}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder={exercise.equipment === 'Bodyweight' ? '0 added' : '0'}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    selectTextOnFocus
                    style={[
                      styles.weightInput,
                      { color: theme.text, backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                </View>

                <View style={styles.field}>
                  <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
                    NOTES · OPTIONAL
                  </ThemedText>
                  <TextInput
                    accessibilityLabel="Workout notes"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Tempo, form, machine setting…"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    maxLength={500}
                    style={[
                      styles.notesInput,
                      { color: theme.text, backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                </View>
              </Animated.View>

              {preview ? (
                <Animated.View
                  entering={FadeInDown.delay(100).duration(260)}
                  style={[styles.previewCard, { borderColor: theme.separator }]}
                >
                  <View>
                    <ThemedText type="smallBold">Entry preview</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {preview.sets} sets × {preview.reps} reps × {displayInputNumber(preview.weight)} {unit}
                    </ThemedText>
                  </View>
                  <View style={styles.previewVolume}>
                    <ThemedText selectable type="metric" style={styles.tabular}>
                      {Math.round(preview.volumeKg)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      volume kg
                    </ThemedText>
                  </View>
                </Animated.View>
              ) : null}

              {error ? (
                <View accessibilityRole="alert" style={styles.errorBanner}>
                  <ThemedText selectable type="small" style={{ color: ErrorRed }}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Save ${exercise.name} entry`}
                accessibilityState={{ disabled: saving, busy: saving }}
                disabled={saving}
                onPress={() => void save()}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: theme.text },
                  saving && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {saving ? 'Saving…' : 'Log gym entry'}
                </ThemedText>
              </Pressable>

              <ThemedText selectable type="caption" style={[styles.localNote, { color: theme.textSecondary }]}>
                Saved locally in OpenFit. Weight is stored canonically in kilograms and shown in your
                chosen unit.
              </ThemedText>
            </>
          ) : (
            <View accessibilityRole="alert" style={styles.loading}>
              <ThemedText selectable type="small" style={{ color: ErrorRed }}>
                {error ?? 'Exercise not found.'}
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.field, styles.numberField]}>
      <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label.toLocaleLowerCase()}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        style={[
          styles.numberInput,
          { color: theme.text, backgroundColor: theme.backgroundSelected },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  container: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  loading: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  exerciseIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: Spacing.half,
  },
  formCard: {
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.four,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  numberField: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  numberInput: {
    minHeight: 58,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  weightInput: {
    minHeight: 64,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 30,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  notesInput: {
    minHeight: 96,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.three,
    fontFamily: Fonts.sans,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  unitControl: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
  },
  unitButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  previewVolume: {
    alignItems: 'flex-end',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 26,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorBanner: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: Spacing.three,
  },
  localNote: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
