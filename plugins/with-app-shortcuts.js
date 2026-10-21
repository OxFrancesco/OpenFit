const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} = require('expo/config-plugins');

const CIRCLE = 'M24,2a22,22 0 1,1 0,44a22,22 0 1,1 0,-44z';
// Material Icons "fitness_center" and "calendar_month", 24dp viewport.
const FITNESS_CENTER =
  'M20.57,14.86L22,13.43 20.57,12 17,15.57 8.43,7 12,3.43 10.57,2 9.14,3.43 7.71,2 5.57,4.14 4.14,2.71 2.71,4.14l1.43,1.43L2,7.71l1.43,1.43L2,10.57 3.43,12 7,8.43 15.57,17 12,20.57 13.43,22l1.43,-1.43L16.29,22l2.14,-2.14 1.43,1.43 1.43,-1.43 -1.43,-1.43L22,16.29z';
const CALENDAR_MONTH =
  'M19,4h-1V2h-2v2H8V2H6v2H5C3.89,4 3.01,4.9 3.01,6L3,20c0,1.1 0.89,2 2,2h14c1.1,0 2,-0.9 2,-2V6C21,4.9 20.1,4 19,4zM19,20H5V10h14V20zM9,14H7v-2h2V14zM13,14h-2v-2h2V14zM17,14h-2v-2h2V14zM9,18H7v-2h2V18zM13,18h-2v-2h2V18zM17,18h-2v-2h2V18z';

const SHORTCUTS = [
  {
    id: 'today',
    long: "Today's workout",
    short: 'Today',
    path: 'fitness?section=today',
    icon: FITNESS_CENTER,
  },
  {
    id: 'history',
    long: 'Training history',
    short: 'History',
    path: 'fitness?section=history',
    icon: CALENDAR_MONTH,
  },
];

const drawable = (glyph) => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp"
    android:height="48dp"
    android:viewportWidth="48"
    android:viewportHeight="48">
    <path android:fillColor="#006C50" android:pathData="${CIRCLE}" />
    <group android:translateX="12" android:translateY="12">
        <path android:fillColor="#FFFFFF" android:pathData="${glyph}" />
    </group>
</vector>
`;

const shortcutsXml = (pkg, scheme) => `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${SHORTCUTS.map(
  (shortcut) => `    <shortcut
        android:shortcutId="${shortcut.id}"
        android:enabled="true"
        android:icon="@drawable/shortcut_${shortcut.id}"
        android:shortcutShortLabel="@string/shortcut_${shortcut.id}_short"
        android:shortcutLongLabel="@string/shortcut_${shortcut.id}_long">
        <intent
            android:action="android.intent.action.VIEW"
            android:data="${scheme}://${shortcut.path.replace(/&/g, '&amp;')}"
            android:targetPackage="${pkg}"
            android:targetClass="${pkg}.MainActivity" />
    </shortcut>`
).join('\n')}
</shortcuts>
`;

module.exports = function withAppShortcuts(config) {
  const pkg = config.android?.package;
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (!pkg || !scheme) throw new Error('App shortcuts need android.package and scheme in app.json.');

  config = withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      SHORTCUTS.flatMap((shortcut) => [
        AndroidConfig.Resources.buildResourceItem({ name: `shortcut_${shortcut.id}_long`, value: shortcut.long }),
        AndroidConfig.Resources.buildResourceItem({ name: `shortcut_${shortcut.id}_short`, value: shortcut.short }),
      ]),
      mod.modResults
    );
    return mod;
  });

  config = withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const metaData = (activity['meta-data'] ?? []).filter(
      (item) => item.$['android:name'] !== 'android.app.shortcuts'
    );
    metaData.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    activity['meta-data'] = metaData;
    return mod;
  });

  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const res = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml/shortcuts.xml'), shortcutsXml(pkg, scheme));
      for (const shortcut of SHORTCUTS) {
        fs.writeFileSync(path.join(res, `drawable/shortcut_${shortcut.id}.xml`), drawable(shortcut.icon));
      }
      return mod;
    },
  ]);
};
