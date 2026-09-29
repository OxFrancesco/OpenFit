import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';
import { readSetupPermissions, requestNotificationPermission, type SetupPermissions } from '@/lib/setup-permissions';

export function PermissionSetup({ onDone }: { onDone: () => Promise<void> }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<SetupPermissions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => readSetupPermissions().then(next => {
    setPermissions(next);
    setError(null);
  }).catch(() => { setError('Could not check permissions. Try again.'); }), []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update permissions.'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, flexGrow: 1 }}>
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 32, flex: 1 }}>
        <ThemedText type="title">Notifications & widgets</ThemedText>
        <View style={{ gap: 12 }}>
          <ThemedText type="subtitle">Notifications</ThemedText>
          <ThemedText themeColor="textSecondary">Allow OpenFit to send notifications, including future exercise reminders.</ThemedText>
          <Button mode="outlined" icon={permissions?.notifications === 'allowed' ? 'check' : 'bell-outline'} disabled={busy || !permissions} onPress={() => void run(permissions?.notifications === 'allowed' ? Linking.openSettings : requestNotificationPermission)} contentStyle={{ minHeight: 48 }}>
            {permissions?.notifications === 'allowed' ? 'Notifications allowed' : permissions?.notifications === 'blocked' ? 'Open notification settings' : 'Allow notifications'}
          </Button>
        </View>
        {Platform.OS === 'android' && (
          <View style={{ gap: 12 }}>
            <ThemedText type="subtitle">Widget updates</ThemedText>
            <ThemedText themeColor="textSecondary">
              {permissions?.widgets === 'unrestricted'
                ? 'Background battery access is unrestricted. Android still controls when widgets refresh.'
                : 'Let widgets update while OpenFit is closed. In app settings, open Battery and choose Unrestricted. This can use more battery.'}
            </ThemedText>
            <Button mode="outlined" icon={permissions?.widgets === 'unrestricted' ? 'check' : 'battery-outline'} disabled={busy || !permissions} onPress={() => void run(Linking.openSettings)} contentStyle={{ minHeight: 48 }}>
              {permissions?.widgets === 'unrestricted' ? 'Background access allowed' : 'Open battery settings'}
            </Button>
          </View>
        )}
        {!permissions && !error && <ActivityIndicator />}
        {error && <View><HelperText type="error" visible>{error}</HelperText><Button onPress={() => void refresh()}>Try again</Button></View>}
        <View style={{ marginTop: 'auto', gap: 8 }}>
          <Button mode="contained" disabled={busy} onPress={() => void run(onDone)} contentStyle={{ minHeight: 52 }}>
            {permissions?.notifications === 'allowed' && permissions.widgets !== 'optimized' ? 'Continue' : 'Not now'}
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}
