"use no memo";

import type { ReactNode } from "react";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import { formatWeight } from "@/lib/fitness-domain";
import type { TodayPlan, WeekStripDay } from "@/lib/today-plan";
import type { PlanRow } from "@/lib/training-plan";
import { dayKey } from "@/lib/training-stats";
import { SECONDARY } from "./shared";
import { widgetPalette } from "./widget-appearance";

const palette = widgetPalette("forest", "light");
const BACKGROUND = palette.background;
const TEXT = palette.secondary;
const ACCENT = palette.slotColors[2];

export const TODAY_URI = "fitty://fitness?section=today";
export const CREATE_SCHEDULE_URI = "fitty://workout-schedule?create=1";

const CHECK_PATH = "M6.5 12.5l3.5 3.5 7.5-8";

/** One SVG for the whole week: trained days filled, today ringed, planned weekdays dotted. */
export function weekStripSvg(week: readonly WeekStripDay[], cell: number) {
  const center = cell / 2;
  const radius = cell * 0.3;
  const marks = week
    .map((day, index) => {
      const cx = (index * cell + center).toFixed(1);
      const at = `cx="${cx}" cy="${center}"`;
      const base = day.active
        ? `<circle ${at} r="${radius}" fill="${ACCENT}"/>`
        : day.today
          ? `<circle ${at} r="${radius - 1}" fill="none" stroke="${TEXT}" stroke-width="2"/>`
          : `<circle ${at} r="${radius - 0.75}" fill="none" stroke="${SECONDARY}" stroke-opacity="${day.future ? 0.3 : 0.6}" stroke-width="1.5"/>`;
      const planned =
        !day.active && day.planned
          ? `<circle ${at} r="${(cell * 0.08).toFixed(1)}" fill="${day.today ? TEXT : SECONDARY}" fill-opacity="${day.future ? 0.55 : 1}"/>`
          : "";
      const ring =
        day.active && day.today
          ? `<circle ${at} r="${(cell * 0.44).toFixed(1)}" fill="none" stroke="${TEXT}" stroke-width="1.5"/>`
          : "";
      return base + planned + ring;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * 7}" height="${cell}" viewBox="0 0 ${cell * 7} ${cell}">${marks}</svg>`;
}

const iconSvg = (path: string, color: string, stroke = 2.5) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${path}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function rowName(row: PlanRow) {
  return row.entry.displayName;
}

export function rowDetails(row: PlanRow) {
  if (row.kind !== "strength") return row.entry.prescription.trim();
  const sets = `${row.sets}×${row.reps}`;
  return row.weightKg ? `${sets} · ${formatWeight(row.weightKg, row.unit)}` : sets;
}

function rowSpeech(row: PlanRow) {
  if (row.kind !== "strength") return rowName(row);
  const weight = row.weightKg ? ` at ${formatWeight(row.weightKg, row.unit)}` : "";
  return `${rowName(row)}, ${row.sets} sets of ${row.reps}${weight}`;
}

function weekText(plan: TodayPlan) {
  const { thisWeek, goal, current } = plan.streak;
  return `${thisWeek}/${goal} this week${current >= 1 ? ` · ${current} wk streak` : ""}`;
}

function planSpeech(plan: TodayPlan) {
  const { thisWeek, goal, current } = plan.streak;
  const week = `${thisWeek} of ${goal} workouts this week${current >= 1 ? `, ${current} week streak` : ""}.`;
  if (!plan.scheduledToday) return `Rest day. Next: ${plan.day}. ${week} Open today's workout`;
  return `${plan.day}, ${plan.doneCount} of ${plan.rows.length} done. ${week} Open today's workout`;
}

function Frame({
  uri,
  label,
  compact,
  centered = false,
  children,
}: {
  uri: string;
  label: string;
  compact: boolean;
  centered?: boolean;
  children: ReactNode;
}) {
  "use no memo";
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel={label}
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: BACKGROUND,
        borderRadius: compact ? 22 : 28,
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 10 : 14,
        flexDirection: "column",
        justifyContent: centered ? "center" : "space-between",
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Header({
  title,
  subtitle,
  progress,
  compact,
}: {
  title: string;
  subtitle: string | null;
  progress: string | null;
  compact: boolean;
}) {
  "use no memo";
  return (
    <FlexWidget
      style={{ width: "match_parent", flexDirection: "row", alignItems: "flex-start" }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <TextWidget
          text={title}
          maxLines={1}
          truncate="END"
          style={{ width: "match_parent", fontSize: compact ? 16 : 18, fontWeight: "bold", color: TEXT }}
        />
        {subtitle ? (
          <TextWidget
            text={subtitle}
            maxLines={1}
            truncate="END"
            style={{ width: "match_parent", fontSize: 12, color: SECONDARY, marginTop: 1 }}
          />
        ) : null}
      </FlexWidget>
      {progress ? (
        <TextWidget
          text={progress}
          maxLines={1}
          style={{ fontSize: compact ? 16 : 18, fontWeight: "bold", color: TEXT, marginLeft: 8 }}
        />
      ) : null}
    </FlexWidget>
  );
}

function WeekRow({ plan, cell, showText }: { plan: TodayPlan; cell: number; showText: boolean }) {
  "use no memo";
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
      <SvgWidget svg={weekStripSvg(plan.week, cell)} style={{ width: cell * 7, height: cell }} />
      {showText ? (
        <FlexWidget style={{ flex: 1, marginLeft: 10 }}>
          <TextWidget
            text={weekText(plan)}
            maxLines={1}
            truncate="END"
            style={{ width: "match_parent", fontSize: 12, color: SECONDARY }}
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

function CheckButton({ date, row, size }: { date: string; row: PlanRow; size: number }) {
  "use no memo";
  return (
    <FlexWidget
      clickAction="LOG_NEXT"
      clickActionData={{ date, key: row.key }}
      accessibilityLabel={`Log ${rowSpeech(row)}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ACCENT,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
      }}
    >
      <SvgWidget svg={iconSvg(CHECK_PATH, BACKGROUND, 2.75)} style={{ width: 24, height: 24 }} />
    </FlexWidget>
  );
}

function LogAllButton({ date, count }: { date: string; count: number }) {
  "use no memo";
  return (
    <FlexWidget
      clickAction="LOG_ALL"
      clickActionData={{ date }}
      accessibilityLabel={`Log all ${count} remaining as planned`}
      style={{ height: 48, borderRadius: 24, justifyContent: "center", paddingHorizontal: 2, marginLeft: 8 }}
    >
      <FlexWidget
        style={{
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: ACCENT,
          paddingHorizontal: 12,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <TextWidget text="Log all" maxLines={1} style={{ fontSize: 13, fontWeight: "bold", color: ACCENT }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function NextRow({
  plan,
  row,
  date,
  compact,
  narrow,
  width,
}: {
  plan: TodayPlan;
  row: PlanRow;
  date: string;
  compact: boolean;
  narrow: boolean;
  width: number;
}) {
  "use no memo";
  const quickLeft = plan.rows.filter((item) => item.quick).length;
  const details = narrow ? "" : rowDetails(row);
  const showName = width >= 150;
  return (
    <FlexWidget
      style={{ width: "match_parent", height: 48, flexDirection: "row", alignItems: "center" }}
    >
      <FlexWidget style={{ flex: 1, height: "match_parent", flexDirection: "column", justifyContent: "center" }}>
        {showName ? (
          <TextWidget
            text={rowName(row)}
            maxLines={1}
            truncate="END"
            style={{ width: "match_parent", fontSize: compact ? 13 : 14, fontWeight: "500", color: TEXT }}
          />
        ) : null}
        {showName && details ? (
          <TextWidget
            text={details}
            maxLines={1}
            truncate="END"
            style={{ width: "match_parent", fontSize: 12, color: SECONDARY, marginTop: 1 }}
          />
        ) : null}
      </FlexWidget>
      {width >= 300 && quickLeft >= 2 ? <LogAllButton date={date} count={quickLeft} /> : null}
      <CheckButton date={date} row={row} size={48} />
    </FlexWidget>
  );
}

function StatusRow({ text, done, compact }: { text: string; done: boolean; compact: boolean }) {
  "use no memo";
  return (
    <FlexWidget
      style={{ width: "match_parent", height: 48, flexDirection: "row", alignItems: "center" }}
    >
      {done ? (
        <SvgWidget svg={iconSvg(CHECK_PATH, ACCENT)} style={{ width: 20, height: 20, marginRight: 6 }} />
      ) : null}
      <TextWidget
        text={text}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 14, fontWeight: done ? "bold" : "normal", color: done ? ACCENT : SECONDARY }}
      />
    </FlexWidget>
  );
}

export type WorkoutTodayWidgetProps = {
  plan: TodayPlan | null;
  width?: number;
  height?: number;
};

export function WorkoutTodayWidget({ plan, width = 320, height = 160 }: WorkoutTodayWidgetProps) {
  "use no memo";
  const narrow = width < 250;
  const compact = narrow || height < 140;
  const inner = width - (compact ? 24 : 32);
  // Wide layouts leave ~170dp beside the strip for the week text.
  const cell = narrow
    ? Math.max(14, Math.min(22, Math.floor(inner / 7)))
    : Math.max(14, Math.min(20, Math.floor((inner - 170) / 7)));

  if (!plan) {
    return (
      <Frame uri={TODAY_URI} label="Open today's workout" compact={compact} centered>
        <Header title="Today's workout" subtitle={null} progress={null} compact={compact} />
      </Frame>
    );
  }

  if (!plan.template || !plan.day) {
    return (
      <Frame uri={CREATE_SCHEDULE_URI} label="Add a schedule" compact={compact} centered>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text="Add a schedule"
              maxLines={2}
              style={{ width: "match_parent", fontSize: compact ? 16 : 18, fontWeight: "bold", color: TEXT }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: ACCENT,
              justifyContent: "center",
              alignItems: "center",
              marginLeft: 8,
            }}
          >
            <SvgWidget svg={iconSvg("M12 5v14M5 12h14", BACKGROUND)} style={{ width: 22, height: 22 }} />
          </FlexWidget>
        </FlexWidget>
      </Frame>
    );
  }

  const date = dayKey(new Date(plan.loadedAt));
  const total = plan.rows.length;
  const allDone = total > 0 && plan.doneCount >= total;
  const restDay = !plan.scheduledToday;
  const row = plan.nextRow;

  return (
    <Frame uri={TODAY_URI} label={planSpeech(plan)} compact={compact}>
      <Header
        title={restDay ? "Rest day" : plan.day}
        subtitle={restDay ? `Next: ${plan.day}` : null}
        progress={restDay || allDone || !total ? null : `${plan.doneCount}/${total}`}
        compact={compact}
      />
      <WeekRow plan={plan} cell={cell} showText={!narrow} />
      {restDay ? null : allDone ? (
        <StatusRow text="Done" done compact={compact} />
      ) : row ? (
        <NextRow plan={plan} row={row} date={date} compact={compact} narrow={narrow} width={width} />
      ) : (
        <StatusRow text="Open to add weights" done={false} compact={compact} />
      )}
    </Frame>
  );
}
