import { router, usePathname } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BottomNavigation, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcon, type MaterialIconName } from './material-icon';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

const destinations: {
  key: '/' | '/fitness' | '/coach' | '/settings';
  title: string;
  icon: MaterialIconName;
}[] = [
  { key: '/', title: 'Health', icon: 'favorite-border' },
  { key: '/fitness', title: 'Workouts', icon: 'fitness-center' },
  { key: '/coach', title: 'Coach', icon: 'chat-bubble-outline' },
  { key: '/settings', title: 'Settings', icon: 'settings' },
];
export function useMainDestination() {
  const pathname = usePathname();
  return destinations.findIndex((item) => item.key === pathname);
}
export function MaterialNavigation() {
  const theme = useTheme();
  const index = useMainDestination();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (index < 0) return null;
  if (width >= 840) {
    return (
      <View
        accessibilityRole="tablist"
        style={[
          styles.rail,
          { backgroundColor: theme.surfaceContainer, paddingTop: insets.top + 24 },
        ]}
      >
        {destinations.map((item, i) => (
          <TouchableRipple
            key={item.key}
            onPress={() => router.replace(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: i === index }}
            style={styles.railItem}
          >
            <View style={styles.railContent}>
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: i === index ? theme.secondaryContainer : 'transparent' },
                ]}
              >
                <MaterialIcon
                  name={item.icon}
                  color={i === index ? theme.onSecondaryContainer : theme.textSecondary}
                />
              </View>
              <ThemedText
                type="smallBold"
                style={{ color: i === index ? theme.text : theme.textSecondary }}
              >
                {item.title}
              </ThemedText>
            </View>
          </TouchableRipple>
        ))}
      </View>
    );
  }
  return (
    <BottomNavigation.Bar
      navigationState={{
        index,
        routes: destinations.map((item) => ({ ...item, accessibilityLabel: item.title })),
      }}
      onTabPress={({ route }) => router.replace(route.key)}
      renderIcon={({ route, color }) => <MaterialIcon name={route.icon} color={color} />}
      activeColor={theme.onSecondaryContainer}
      inactiveColor={theme.textSecondary}
      activeIndicatorStyle={{ backgroundColor: theme.secondaryContainer }}
      style={{ backgroundColor: theme.surfaceContainer }}
      safeAreaInsets={{ bottom: insets.bottom }}
      keyboardHidesNavigationBar
    />
  );
}
const styles = StyleSheet.create({
  rail: { width: 104, alignItems: 'center', gap: 16, paddingHorizontal: 8 },
  railItem: { borderRadius: 24, width: '100%' },
  railContent: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
