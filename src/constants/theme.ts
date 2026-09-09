import '@/global.css';

export const RingColors = { steps: '#007D60', calories: '#C45735', minutes: '#687A26' } as const;
export const ErrorRed = '#BA1A1A';
export const RingGoals = { steps: 10_000, calories: 500, minutes: 30 } as const;

export const Colors = {
  light: {
    text: '#17211C',
    background: '#F5F9F5',
    backgroundElement: '#EAF1EB',
    backgroundSelected: '#DCE8DF',
    card: '#EAF1EB',
    textSecondary: '#4D6357',
    separator: '#BFCFC3',
    rule: '#17211C',
    primary: '#006C50',
    onPrimary: '#FFFFFF',
    primaryContainer: '#A8F2CE',
    onPrimaryContainer: '#002116',
    secondary: '#486454',
    secondaryContainer: '#CCE9D5',
    onSecondaryContainer: '#102D1E',
    tertiary: '#775A23',
    tertiaryContainer: '#FFDEA2',
    onTertiaryContainer: '#291800',
    surface: '#F5F9F5',
    surfaceContainer: '#EAF1EB',
    surfaceContainerHigh: '#E0E9E2',
    surfaceContainerHighest: '#DCE5DD',
    outline: '#708579',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',
  },
  dark: {
    text: '#DFE9E0',
    background: '#0F1511',
    backgroundElement: '#1B231D',
    backgroundSelected: '#2F3A32',
    card: '#1B231D',
    textSecondary: '#B7CABD',
    separator: '#405348',
    rule: '#DFE9E0',
    primary: '#8DD5B3',
    onPrimary: '#003827',
    primaryContainer: '#00513A',
    onPrimaryContainer: '#A8F2CE',
    secondary: '#B0CDB9',
    secondaryContainer: '#304C3B',
    onSecondaryContainer: '#CCE9D5',
    tertiary: '#E8C17F',
    tertiaryContainer: '#5C420E',
    onTertiaryContainer: '#FFDEA2',
    surface: '#0F1511',
    surfaceContainer: '#1B231D',
    surfaceContainerHigh: '#252E27',
    surfaceContainerHighest: '#303A32',
    outline: '#8A9F91',
    error: '#FFB4AB',
    errorContainer: '#93000A',
    onErrorContainer: '#FFDAD6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;
export const Fonts = {
  sans: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold',
  serif: 'serif',
  rounded: 'Roboto_500Medium',
  mono: 'monospace',
};
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Shape = { small: 12, medium: 16, large: 24, extraLarge: 28, full: 999 } as const;
export const BottomTabInset = 80;
export const MaxContentWidth = 840;
export const MetricCardMinHeight = 144;
