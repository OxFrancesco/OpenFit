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
let checked = 0;
for (const [index, source] of map.sources.entries()) {
  const relative = source.slice(source.indexOf("/src/") + 1);
  if (
    !relative.startsWith("src/widgets/android/") &&
    relative !== "src/lib/widget-sync.android.ts"
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
