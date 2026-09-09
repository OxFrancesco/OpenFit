'use no memo';

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { normalizeSlots } from './shared';
import { heartRingsSvg } from './ring-svg';
import { WidgetEditButton } from './widget-controls';
import { WidgetFrame, type WidgetProps } from './widget-layout';
import { widgetPalette } from './widget-appearance';

export function RingValuesWidget({
  data,
  width = 180,
  height = 250,
  background,
}: WidgetProps) {
  'use no memo';
  const slots = normalizeSlots(data);
  const palette = widgetPalette(background);
  const horizontal = width > height * 1.2;
  const columns = !horizontal && width >= 270;
  const heartSize = Math.max(
    48,
    Math.min(
      horizontal ? width * 0.52 : width - 24,
      horizontal ? height - 46 : height - (columns ? 116 : 124)
    )
  );
  return (
    <WidgetFrame background={background}>
      <FlexWidget style={{ width: 'match_parent', alignItems: 'flex-end' }}>
        <WidgetEditButton compact />
      </FlexWidget>
      <FlexWidget
        style={{
          flex: 1,
          width: 'match_parent',
          flexDirection: horizontal ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FlexWidget
          style={{
            ...(horizontal
              ? { height: 'match_parent' as const }
              : { width: 'match_parent' as const }),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SvgWidget
            svg={heartRingsSvg(slots, heartSize)}
            style={{ width: heartSize, height: heartSize }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            ...(horizontal ? { flex: 1 } : { width: 'match_parent' as const }),
            flexDirection: columns ? 'row' : 'column',
            marginTop: horizontal ? 0 : 8,
          }}
        >
          {slots.map((slot, index) => (
            <FlexWidget
              key={index}
              style={{
                ...(columns
                  ? { flex: 1, paddingHorizontal: 4 }
                  : {
                      width: 'match_parent' as const,
                      height: horizontal ? 48 : 23,
                    }),
                flexDirection: columns || horizontal ? 'column' : 'row',
                alignItems: columns ? 'center' : 'flex-start',
                justifyContent:
                  columns || horizontal ? 'center' : 'space-between',
              }}
            >
              <TextWidget
                text={slot.label}
                maxLines={1}
                style={{
                  fontSize: columns ? 12 : 11,
                  color: palette.secondary,
                  adjustsFontSizeToFit: true,
                }}
              />
              <TextWidget
                text={
                  columns || horizontal
                    ? slot.display
                    : `${slot.display}${slot.unit.toLowerCase() === slot.label.toLowerCase() ? '' : ` ${slot.unit}`}`
                }
                maxLines={1}
                style={{
                  fontSize: columns
                    ? Math.min(34, (width - 24) / 10)
                    : horizontal
                      ? 25
                      : 16,
                  fontWeight: 'bold',
                  color: slot.color,
                  adjustsFontSizeToFit: true,
                }}
              />
              {columns &&
              slot.unit.toLowerCase() !== slot.label.toLowerCase() ? (
                <TextWidget
                  text={slot.unit}
                  maxLines={1}
                  style={{
                    fontSize: 11,
                    color: palette.secondary,
                    adjustsFontSizeToFit: true,
                  }}
                />
              ) : null}
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>
    </WidgetFrame>
  );
}
