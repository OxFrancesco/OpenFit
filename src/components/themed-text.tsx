import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'hero'
    | 'metric'
    | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'], fontFamily: ['title', 'subtitle', 'smallBold', 'metric'].includes(type) ? Fonts.medium : Fonts.sans },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'hero' && styles.hero,
        type === 'metric' && styles.metric,
        type === 'caption' && styles.caption,
        style,
      ]}
      {...rest}
    />
  );
}

// Material 3 type roles shared by native and web screens.
const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 400,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 400,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 500,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 500,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,

  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 20,
  },
  hero: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: 500,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
  metric: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 500,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 400,
  },
});
