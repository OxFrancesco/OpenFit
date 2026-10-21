import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dir, "..");
const map = JSON.parse(
  readFileSync(
    resolve(
      root,
      "android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map",
    ),
    "utf8",
  ),
);
assert(
  map.sources.some((source) =>
    source.endsWith("/src/lib/widget-sync.android.ts"),
  ),
  "Android bundle must include the Android widget sync implementation",
);
assert(
  !map.sources.some((source) => source.endsWith("/src/lib/widget-sync.ts")),
  "Android bundle must not include the web widget sync no-op",
);
assert(
  map.sources.some((source) =>
    source.endsWith("/src/lib/training-widget-sync.android.ts"),
  ),
  "Android bundle must include the Android training widget sync implementation",
);
assert(
  !map.sources.some((source) =>
    source.endsWith("/src/lib/training-widget-sync.ts"),
  ),
  "Android bundle must not include the training widget sync no-op",
);
// Widget code outside src/widgets/android, including the plan the WorkoutToday widget renders.
const widgetLibSources = new Set([
  "src/lib/widget-sync.android.ts",
  "src/lib/background-refresh.ts",
  "src/lib/health-source.ts",
  "src/lib/training-widget-sync.android.ts",
  "src/lib/today-plan.ts",
  "src/lib/training-plan.ts",
  "src/lib/training-stats.ts",
  "src/lib/fitness-store.ts",
  "src/lib/fitness-domain.ts",
  "src/lib/exercise-catalog.ts",
  "src/lib/workout-schedule-store.ts",
  "src/lib/schedule-library.ts",
  "src/lib/workout-schedule.ts",
  "src/lib/device-health-core.ts",
  "src/lib/metric-catalog.ts",
]);
let checked = 0;
for (const [index, source] of map.sources.entries()) {
  const relative = source.slice(source.indexOf("/src/") + 1);
  if (
    !relative.startsWith("src/widgets/android/") &&
    !widgetLibSources.has(relative)
  )
    continue;
  assert.equal(
    map.sourcesContent[index],
    readFileSync(resolve(root, relative), "utf8"),
    `Bundled source is stale: ${relative}`,
  );
  checked += 1;
}
assert(checked > 1, "No Android widget layout sources found");
console.log(
  `Verified ${checked} Android widget sources match the release bundle.`,
);
