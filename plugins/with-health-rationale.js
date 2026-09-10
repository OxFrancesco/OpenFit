const { withMainActivity } = require('expo/config-plugins');

module.exports = function withHealthRationale(config) {
  return withMainActivity(config, mod => {
    const marker = '// OpenFit Health Connect privacy link';
    if (mod.modResults.contents.includes(marker)) return mod;
    const route = `
    ${marker}
    if (intent?.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        intent?.action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      intent.action = android.content.Intent.ACTION_VIEW
      intent.data = android.net.Uri.parse("fitty://privacy")
    }
`;
    mod.modResults.contents = mod.modResults.contents.replace(
      'super.onCreate(null)', `${route}\n    super.onCreate(null)`
    );
    const method = `
  override fun onNewIntent(intent: android.content.Intent) {
    if (intent.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        intent.action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      intent.action = android.content.Intent.ACTION_VIEW
      intent.data = android.net.Uri.parse("fitty://privacy")
    }
    super.onNewIntent(intent)
  }
`;
    if (mod.modResults.contents.includes('override fun onNewIntent')) {
      throw new Error('Review MainActivity onNewIntent before adding the health privacy route.');
    }
    const lastBrace = mod.modResults.contents.lastIndexOf('}');
    mod.modResults.contents = mod.modResults.contents.slice(0, lastBrace) + method + mod.modResults.contents.slice(lastBrace);
    return mod;
  });
};
