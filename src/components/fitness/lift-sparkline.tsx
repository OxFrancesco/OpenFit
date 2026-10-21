import { memo } from 'react';
import Svg, { Circle, Polyline } from 'react-native-svg';

const PAD = 4;

/** Trend line of a lift's top weight per session, oldest first. */
export const LiftSparkline = memo(function LiftSparkline({
  values,
  color,
  width = 88,
  height = 32,
}: {
  values: readonly number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min;
  const step = values.length > 1 ? (width - PAD * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: values.length > 1 ? PAD + index * step : width - PAD,
    y: range > 0 ? height - PAD - ((value - min) / range) * (height - PAD * 2) : height / 2,
  }));
  const end = points[points.length - 1];

  return (
    <Svg width={width} height={height} accessible={false} pointerEvents="none">
      {points.length > 1 ? (
        <Polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.55}
        />
      ) : null}
      <Circle cx={end.x} cy={end.y} r={3.5} fill={color} />
    </Svg>
  );
});
