import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
export function MaterialIcon({
  name,
  size = 24,
  color,
}: {
  name: MaterialIconName;
  size?: number;
  color: string;
}) {
  return <MaterialIcons name={name} size={size} color={color} accessible={false} />;
}
