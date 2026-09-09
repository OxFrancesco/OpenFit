import { type ReactNode, useMemo } from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, configureFonts } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';

export function MaterialProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const colors = useTheme();
  const reducedMotion = useReducedMotion();
  const theme = useMemo(() => {
    const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      roundness: 6,
      animation: { scale: reducedMotion ? 0 : 1 },
      fonts: configureFonts({ config: { fontFamily: Fonts.sans } }),
      colors: {
        ...base.colors,
        ...colors,
        onSurface: colors.text,
        onBackground: colors.text,
        onSurfaceVariant: colors.textSecondary,
        surfaceVariant: colors.surfaceContainerHigh,
        outlineVariant: colors.separator,
        elevation: {
          level0: 'transparent',
          level1: colors.surfaceContainer,
          level2: colors.surfaceContainerHigh,
          level3: colors.surfaceContainerHigh,
          level4: colors.surfaceContainerHighest,
          level5: colors.surfaceContainerHighest,
        },
      },
    };
  }, [colors, reducedMotion, scheme]);
  return <PaperProvider theme={theme}>{children}</PaperProvider>;
}
