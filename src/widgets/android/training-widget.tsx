"use no memo";

import {
  getWidgetInfo,
  requestWidgetUpdateById,
  type WidgetInfo,
  type WidgetTaskHandlerProps,
} from "react-native-android-widget";
import {
  completePlanRow,
  completeRemainingRows,
  loadTodayPlan,
  type TodayPlan,
} from "@/lib/today-plan";
import type { PlanRow } from "@/lib/training-plan";
import { dayKey } from "@/lib/training-stats";
import { WorkoutTodayWidget } from "./workout-today-widget";

export const TRAINING_WIDGET_NAME = "WorkoutToday";

/** Last plan loaded in this JS runtime; only reused on the same day when a load fails. */
let lastPlan: TodayPlan | null = null;

/**
 * Each widget event runs as its own headless task in one JS runtime. Running them one at a time
 * means a second tap reloads the plan after the first one saved, so it can't log the same row twice.
 */
let queue: Promise<void> = Promise.resolve();
function serially(task: () => Promise<void>) {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const loadedToday = (plan: TodayPlan | null): plan is TodayPlan =>
  plan !== null && dayKey(new Date(plan.loadedAt)) === dayKey(new Date());

async function loadWidgetPlan() {
  try {
    lastPlan = await loadTodayPlan();
  } catch {
    if (!loadedToday(lastPlan)) lastPlan = null;
  }
  return lastPlan;
}

export function renderTrainingWidget(
  plan: TodayPlan | null,
  size: Pick<WidgetInfo, "width" | "height">,
) {
  return <WorkoutTodayWidget plan={plan} width={size.width} height={size.height} />;
}

function drawWidgets(plan: TodayPlan | null, widgets: readonly WidgetInfo[]) {
  return Promise.all(
    widgets.map((info) =>
      requestWidgetUpdateById({
        widgetName: TRAINING_WIDGET_NAME,
        widgetId: info.widgetId,
        renderWidget: (size) => renderTrainingWidget(plan, size),
      }),
    ),
  );
}

/** Redraws every WorkoutToday widget from a freshly loaded plan. */
export async function updateTrainingWidgets() {
  const widgets = await getWidgetInfo(TRAINING_WIDGET_NAME);
  if (!widgets.length) return;
  await drawWidgets(await loadWidgetPlan(), widgets);
}

/** The plan as it will look once `rows` are saved, drawn before the write finishes. */
function optimisticPlan(plan: TodayPlan, rows: readonly PlanRow[]): TodayPlan {
  const keys = new Set(rows.map((row) => row.key));
  const next = plan.rows.map((row) => (keys.has(row.key) ? { ...row, quick: false } : row));
  return {
    ...plan,
    rows: next,
    doneCount: plan.doneCount + keys.size,
    nextRow: next.find((row) => row.quick) ?? null,
  };
}

/** Saves the tapped action. Returns true when something was written. */
async function runClick(
  action: string | undefined,
  data: Record<string, unknown>,
  render: (plan: TodayPlan) => void,
) {
  if (action !== "LOG_NEXT" && action !== "LOG_ALL") return false;
  // A widget drawn yesterday must not log into today's plan.
  if (data.date !== dayKey(new Date())) return false;
  const plan = await loadTodayPlan();
  lastPlan = plan;
  if (action === "LOG_NEXT") {
    const row = plan.rows.find((item) => item.key === data.key);
    if (!row?.quick) return false;
    render(optimisticPlan(plan, [row]));
    return (await completePlanRow(plan, row)) !== null;
  }
  const quick = plan.rows.filter((row) => row.quick);
  if (!quick.length) return false;
  render(optimisticPlan(plan, quick));
  const { logs, checkins } = await completeRemainingRows(plan);
  return logs.length + checkins.length > 0;
}

export function handleTrainingWidgetTask(props: WidgetTaskHandlerProps) {
  return serially(() => runTrainingWidgetTask(props));
}

async function runTrainingWidgetTask(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo } = props;
  if (widgetAction === "WIDGET_DELETED") return;
  const render = (plan: TodayPlan | null) =>
    props.renderWidget(renderTrainingWidget(plan, widgetInfo));

  let changed = false;
  if (widgetAction === "WIDGET_CLICK") {
    try {
      changed = await runClick(props.clickAction, props.clickActionData ?? {}, render);
    } catch {
      // The fresh render below shows whatever was saved.
    }
  }

  const plan = await loadWidgetPlan();
  render(plan);
  if (!changed) return;
  try {
    const others = (await getWidgetInfo(TRAINING_WIDGET_NAME)).filter(
      (info) => info.widgetId !== widgetInfo.widgetId,
    );
    await drawWidgets(plan, others);
  } catch {
    // Other copies catch up on their next update.
  }
}
