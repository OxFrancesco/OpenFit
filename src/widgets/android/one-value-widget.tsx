'use no memo';
import { widgetPalette } from './widget-appearance';

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { normalizeSlots } from './shared';
import { WidgetEditButton } from './widget-controls';
import { WidgetFrame, type WidgetProps } from './widget-layout';

export function OneValueWidget({
  data,
  background,
  width = 80,
  height = 80,
}: WidgetProps) {
  'use no memo';
  const palette = widgetPalette(background);
  const [slot] = normalizeSlots(data);
  const compact = width < 120 || height < 110;
  const unit =
    slot.unit.toLowerCase() === slot.label.toLowerCase() ? '' : slot.unit;
  return (
    <WidgetFrame compact={compact} background={background}>
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={slot.label}
            maxLines={1}
            style={{
              fontSize: compact ? 10 : 13,
              color: palette.secondary,
              adjustsFontSizeToFit: true,
            }}
          />
        </FlexWidget>
        <WidgetEditButton compact />
      </FlexWidget>
      <FlexWidget
        style={{ flex: 1, width: 'match_parent', justifyContent: 'center' }}
      >
        <TextWidget
          text={slot.display}
          maxLines={1}
          style={{
            fontSize: compact ? 27 : 44,
            fontWeight: 'bold',
            color: slot.color,
            adjustsFontSizeToFit: true,
          }}
        />
        {unit ? (
          <TextWidget
            text={unit}
            maxLines={1}
            style={{
              fontSize: compact ? 10 : 13,
              color: palette.secondary,
              adjustsFontSizeToFit: true,
            }}
          />
        ) : null}
      </FlexWidget>
    </WidgetFrame>
  );
}
