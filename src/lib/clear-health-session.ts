import { clearStoredToken } from './token-store';
import { clearSnapshotCache } from './health-cache';
import { loadDashboardPrefs } from './dashboard-prefs';
import { emptyWidgetData } from './widget-data';
import { syncWidgets } from './widget-sync';
import { unregisterWidgetRefresh } from './background-refresh';

export async function clearHealthSession() {
  clearSnapshotCache();
  await clearStoredToken();
  await syncWidgets(emptyWidgetData(await loadDashboardPrefs()));
  await unregisterWidgetRefresh();
}
