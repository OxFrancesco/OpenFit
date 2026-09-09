export const WIDGET_BACKGROUNDS = [
  'forest',
  'black',
  'light',
  'tinted',
  'transparent',
] as const;
export type WidgetBackground = (typeof WIDGET_BACKGROUNDS)[number];

export function widgetPalette(background: WidgetBackground = 'forest') {
  const light = background === 'light';
  return {
    background: {
      forest: '#14201A',
      black: '#101010',
      light: '#F1F5EF',
      tinted: '#14201A99',
      transparent: '#00000000',
    }[background] as `#${string}`,
    secondary: light ? ('#526056' as const) : ('#ABB9AF' as const),
    panel: light
      ? ('#E2E9E0' as const)
      : background === 'transparent'
        ? ('#00000000' as const)
        : ('#FFFFFF09' as const),
    separator: light ? ('#CAD5CA' as const) : ('#FFFFFF20' as const),
  };
}

export function normalizeWidgetBackground(value: unknown): WidgetBackground {
  return WIDGET_BACKGROUNDS.includes(value as WidgetBackground)
    ? (value as WidgetBackground)
    : 'forest';
}
