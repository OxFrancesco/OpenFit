const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withWidgetBundleInputs(config) {
  return withAppBuildGradle(config, (mod) => {
    const marker = "// OpenFit widget bundle inputs";
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `
${marker}
// React Native excludes every android/ directory from its default JS inputs.
tasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {
    inputs.dir(new File(projectRoot, "src/widgets/android"))
}
`;
    }
    return mod;
  });
};
