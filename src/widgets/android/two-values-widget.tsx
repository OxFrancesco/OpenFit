'use no memo';
import { widgetPalette } from './widget-appearance';

import { FlexWidget } from 'react-native-android-widget';
import { normalizeSlots } from './shared';
import { WidgetEditButton } from './widget-controls';
import { MetricValue, WidgetFrame, type WidgetProps } from './widget-layout';

export function TwoValuesWidget({
  data,
  background,
  width = 180,
  height = 180,
}: WidgetProps) {
  'use no memo';
  const palette = widgetPalette(background);
  const slots = normalizeSlots(data).slice(0, 2);
  const horizontal = width > height * 1.6;
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
          flexGap: horizontal ? 14 : 10,
        }}
      >
        {slots.map((slot, index) => (
          <FlexWidget
            key={index}
            style={{
              flex: 1,
              ...(horizontal ? {} : { width: 'match_parent' as const }),
              justifyContent: 'center',
              backgroundColor: palette.panel,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: height < 180 ? 2 : 8,
            }}
          >
            <MetricValue
              compact={height < 180}
              secondary={palette.secondary}
              slot={slot}
              size={
                height < 180
                  ? 22
                  : Math.min(40, Math.max(26, width / (horizontal ? 8 : 5.8)))
              }
            />
          </FlexWidget>
        ))}
      </FlexWidget>
    </WidgetFrame>
  );
}
