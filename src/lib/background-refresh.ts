import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { loadDashboardPrefs } from '@/lib/dashboard-prefs';
import { fetchHealthMetrics, isHealthEnabled } from '@/lib/health-source';
import { buildWidgetData, getWidgetMetricIds } from '@/lib/widget-data';
import { syncWidgets } from '@/lib/widget-sync';

/**
 * Periodically refetches today's ring metrics and pushes them to the
 * home-screen widgets while the app is backgrounded. The OS decides the
 * actual cadence; every foreground open re-syncs immediately regardless.
 */

export const WIDGET_REFRESH_TASK = 'fitty-widget-refresh';

if (Platform.OS !== 'web') {
  // Must run in global scope so the task survives headless launches.
  TaskManager.defineTask(WIDGET_REFRESH_TASK, async () => {
    try {
      if (!await isHealthEnabled()) return BackgroundTask.BackgroundTaskResult.Success;
      const prefs = await loadDashboardPrefs();
      const { metrics } = await fetchHealthMetrics(
        getWidgetMetricIds(prefs, { includeConfigurable: Platform.OS === 'ios' }),
        1
      );
      await syncWidgets(buildWidgetData(prefs, metrics));
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerWidgetRefresh() {
  if (Platform.OS !== 'ios') {
    return;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return;
  }

  // Minutes; the OS treats it as a floor, not a schedule.
  await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK, { minimumInterval: 30 });
}

export async function unregisterWidgetRefresh() {
  if (Platform.OS !== 'ios') {
    return;
  }

  await BackgroundTask.unregisterTaskAsync(WIDGET_REFRESH_TASK).catch(() => undefined);
}
