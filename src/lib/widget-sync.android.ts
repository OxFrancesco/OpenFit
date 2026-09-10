import type { WidgetData } from "@/lib/widget-data";
import { saveLastWidgetData } from "@/lib/widget-store";
import { syncAndroidWidgets } from "@/widgets/android/sync";

export async function syncWidgets(data: WidgetData): Promise<void> {
  const saved = await saveLastWidgetData(data);
  await syncAndroidWidgets(saved).catch((error) => {
    console.warn(
      "Android widget sync failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  });
}
