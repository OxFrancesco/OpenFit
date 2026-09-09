'use no memo';

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { getMetricDef } from '@/lib/metric-catalog';
import type { WidgetPreferences } from './widget-preferences';
import { normalizeWidgetBackground } from './widget-appearance';
import { CARD_BACKGROUND } from './shared';

export function WidgetEditButton({ compact = false }: { compact?: boolean }) {
  'use no memo';
  return (
    <SvgWidget
      svg='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="m15 5 4 4M5 19l4-1 11-11a2.8 2.8 0 0 0-4-4L5 14z" fill="none" stroke="#ABB9AF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      clickAction="EDIT"
      accessibilityLabel="Customize this widget"
      style={{
        width: compact ? 22 : 28,
        height: compact ? 22 : 28,
        padding: compact ? 4 : 6,
      }}
    />
  );
}

export function WidgetControls({
  prefs,
  count,
  height = 180,
}: {
  prefs: WidgetPreferences;
  count: number;
  height?: number;
}) {
  'use no memo';
  const small = count === 1;
  const large = height >= 240;
  const background = normalizeWidgetBackground(prefs.background);
  const backgroundLabel = {
    forest: 'Forest',
    black: 'Black',
    light: 'Light',
    tinted: 'Tinted',
    transparent: 'Transparent',
  }[background];
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#00000000',
      }}
    >
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 'wrap_content',
          backgroundColor: CARD_BACKGROUND,
          borderRadius: 24,
          padding: small ? 5 : large ? 10 : 8,
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
      >
        {prefs.metrics.slice(0, count).map((id, slot) => (
          <FlexWidget
            key={slot}
            style={{
              width: 'match_parent',
              height: small ? 27 : large ? 38 : 30,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#26322B',
              borderRadius: small ? 8 : 12,
              marginBottom: small ? 2 : large ? 6 : 4,
            }}
          >
            <TextWidget
              text="‹"
              clickAction="CHOOSE"
              clickActionData={{ slot, direction: -1 }}
              accessibilityLabel={`Previous metric for value ${slot + 1}`}
              style={{
                width: small ? 16 : 36,
                fontSize: small ? 20 : 25,
                color: '#EAF3EB',
                textAlign: 'center',
              }}
            />
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={
                  getMetricDef(id)?.shortLabel ?? getMetricDef(id)?.label ?? id
                }
                maxLines={1}
                style={{
                  fontSize: small ? 10 : 13,
                  color: '#EAF3EB',
                  textAlign: 'center',
                  adjustsFontSizeToFit: true,
                }}
              />
            </FlexWidget>
            <TextWidget
              text="›"
              clickAction="CHOOSE"
              clickActionData={{ slot, direction: 1 }}
              accessibilityLabel={`Next metric for value ${slot + 1}`}
              style={{
                width: small ? 16 : 36,
                fontSize: small ? 20 : 25,
                color: '#EAF3EB',
                textAlign: 'center',
              }}
            />
          </FlexWidget>
        ))}
        <FlexWidget
          clickAction="BACKGROUND"
          accessibilityLabel={`Background: ${backgroundLabel}. Tap for next background.`}
          style={{
            width: 'match_parent',
            height: small ? 18 : large ? 32 : 26,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: small ? 2 : 10,
            backgroundColor: '#26322B',
            borderRadius: small ? 6 : 10,
            marginBottom: small ? 2 : large ? 6 : 4,
          }}
        >
          {!small ? (
            <TextWidget
              text="Background"
              style={{ fontSize: 12, color: '#B2C3B6' }}
            />
          ) : null}
          <TextWidget
            text={`${backgroundLabel} ›`}
            maxLines={1}
            style={{
              fontSize: small ? 9 : 12,
              color: '#EAF3EB',
              adjustsFontSizeToFit: true,
            }}
          />
        </FlexWidget>
        <TextWidget
          text="Done"
          clickAction="DONE"
          accessibilityLabel="Save widget appearance"
          style={{
            width: 'match_parent',
            height: small ? 18 : large ? 30 : 26,
            fontSize: small ? 10 : 13,
            fontWeight: 'bold',
            color: '#173321',
            backgroundColor: '#B9E8C9',
            borderRadius: small ? 6 : 10,
            textAlign: 'center',
            paddingTop: small ? 1 : large ? 6 : 4,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
