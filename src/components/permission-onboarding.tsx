import { useAuth } from '@clerk/expo';
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { PermissionSetup } from './permission-setup';
import { completePermissionSetup, hasCompletedPermissionSetup } from '@/lib/setup-permissions';
import { useTheme } from '@/hooks/use-theme';

export function PermissionOnboarding({ children }: { children: ReactNode }) {
  const { isLoaded, userId } = useAuth();
  const theme = useTheme();
  const [checked, setChecked] = useState<{ userId: string; complete: boolean } | null>(null);
  useEffect(() => {
    if (!isLoaded || !userId || Platform.OS === 'web') return;
    let active = true;
    void hasCompletedPermissionSetup(userId).then(complete => {
      if (active) setChecked({ userId, complete });
    }).catch(() => { if (active) setChecked({ userId, complete: false }); });
    return () => { active = false; };
  }, [isLoaded, userId]);

  const pending = Platform.OS !== 'web' && isLoaded && userId &&
    (checked?.userId !== userId || !checked.complete);
  return <>{children}{pending && (
    <Modal visible onRequestClose={() => {}}>
      {checked?.userId !== userId
        ? <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}><ActivityIndicator /></View>
        : <PermissionSetup onDone={async () => {
          await completePermissionSetup(userId);
          setChecked({ userId, complete: true });
        }} />}
    </Modal>
  )}</>;
}
