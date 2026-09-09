# Widget design references

Generated with the built-in image_gen tool. Each PNG is a design reference, not a phone screenshot. The exact prompts are in prompts.json.

- one-value.png: one metric with a large value.
- two-values.png: two metric rows separated by a thin line.
- hearts.png: three heart rings with a three-column footer.
- editor.png: centered metric selectors, background selection, and Done.

Native Android components recreate the references with live data, saved metric selections, and per-widget backgrounds. Layouts adapt to Samsung launcher dimensions.

TypeScript, lint, and 63 tests passed with 180 assertions. Physical rendering of this revision still needs verification.

The arm64 release APK built successfully with Gradle code shrinking disabled for this local install. The default R8 build stops on missing kotlin.MustUseReturnValues from kotlinx.io. APK SHA-256: 35948a6642adba456d8210a74ab0b684af6d33eaffa19424bc051312e94cc09e.
