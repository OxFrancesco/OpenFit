import type { WidgetData } from "@/lib/widget-data";
import { saveLastWidgetData } from "@/lib/widget-store";
import { syncAndroidWidgets } from "@/widgets/android/sync";

export async function syncWidgets(data: WidgetData): Promise<void> {
  await saveLastWidgetData(data).catch(() => undefined);
  await syncAndroidWidgets(data).catch((error) => {
    console.warn(
      "Android widget sync failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  });
}
