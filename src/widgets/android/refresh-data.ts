import { loadStoredToken } from "@/lib/token-store";
import { ensureFreshToken } from "@/lib/google-auth";
import { fetchHealthMetrics } from "@/lib/google-health";
import { loadDashboardPrefs } from "@/lib/dashboard-prefs";
import { buildWidgetData, type WidgetData } from "@/lib/widget-data";
import { loadLastWidgetData, saveLastWidgetData } from "@/lib/widget-store";

export async function refreshWidgetMetrics(
  ids: string[],
): Promise<WidgetData | null> {
  const stored = await loadStoredToken();
  if (!stored || !ids.length) return loadLastWidgetData();
  const token = await ensureFreshToken(stored);
  const { metrics } = await fetchHealthMetrics(
    token.accessToken,
    [...new Set(ids)],
    1,
  );
  if ((await loadStoredToken())?.clerkUserId !== token.clerkUserId) return null;
  const updated = buildWidgetData(await loadDashboardPrefs(), metrics);
  return saveLastWidgetData(updated);
}
