import { expect, test } from "bun:test";
import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve as pathResolve } from "node:path";
import { resolve } from "metro-resolver";
import { getDefaultConfig } from "expo/metro-config";

const root = pathResolve(import.meta.dir, "../..");
const config = getDefaultConfig(root);
const context = {
  assetExts: new Set(config.resolver.assetExts),
  sourceExts: config.resolver.sourceExts,
  preferNativePlatform: true,
  originModulePath: pathResolve(root, "src/app/index.tsx"),
  redirectModulePath: (path) => path,
  getPackageForModule: () => null,
  fileSystemLookup: (path) =>
    existsSync(path)
      ? {
          exists: true,
          type: statSync(path).isDirectory() ? "d" : "f",
          realPath: realpathSync(path),
        }
      : { exists: false },
};

for (const [platform, file] of [
  ["android", "widget-sync.android.ts"],
  ["ios", "widget-sync.ios.ts"],
  ["web", "widget-sync.ts"],
]) {
  test(`${platform} resolves the correct widget sync with the real Metro resolver`, () => {
    expect(resolve(context, "../lib/widget-sync", platform)).toEqual({
      type: "sourceFile",
      filePath: pathResolve(root, "src/lib", file),
    });
  });
}
