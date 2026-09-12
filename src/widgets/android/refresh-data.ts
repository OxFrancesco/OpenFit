import { AppState } from 'react-native';
import { canReadDeviceHealthInBackground, fetchHealthMetrics, isHealthEnabled } from "@/lib/health-source";
import { loadDashboardPrefs } from "@/lib/dashboard-prefs";
import { buildWidgetData, emptyWidgetData, type WidgetData } from "@/lib/widget-data";
import { loadLastWidgetData, saveLastWidgetData } from "@/lib/widget-store";
export async function refreshWidgetMetrics(ids: string[]): Promise<WidgetData | null> {
  const prefs = await loadDashboardPrefs();
  if (!await isHealthEnabled()) return saveLastWidgetData(emptyWidgetData(prefs));
  // Without the Health Connect background grant, headless renders keep the last foreground snapshot.
  if (AppState.currentState !== 'active' && !await canReadDeviceHealthInBackground().catch(() => false)) return loadLastWidgetData();
  if (!ids.length) return loadLastWidgetData();
  const { metrics } = await fetchHealthMetrics([...new Set(ids)], 1);
  if (!await isHealthEnabled()) return null;
  return saveLastWidgetData(buildWidgetData(prefs, metrics));
}
