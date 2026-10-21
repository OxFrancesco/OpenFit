import { Platform } from 'react-native';
import { getWidgetInfo, requestPinWidget } from 'react-native-android-widget';
import { TRAINING_WIDGET_NAME, updateTrainingWidgets } from '@/widgets/android/training-widget';

/** Redraws every WorkoutToday widget from a fresh plan. No-op when none is placed. */
export async function syncTrainingWidgets(): Promise<void> {
  await updateTrainingWidgets();
}

/** Pinning needs Android 8+; whether the launcher supports it is only known when asking. */
export async function canPinTrainingWidget(): Promise<boolean> {
  return Number(Platform.Version) >= 26;
}

export async function hasTrainingWidget(): Promise<boolean> {
  try {
    return (await getWidgetInfo(TRAINING_WIDGET_NAME)).length > 0;
  } catch {
    return false;
  }
}

/** Opens the launcher's add-widget prompt. Resolves false if the launcher refused. */
export async function pinTrainingWidget(): Promise<boolean> {
  try {
    return await requestPinWidget({ widgetName: TRAINING_WIDGET_NAME });
  } catch {
    return false;
  }
}
