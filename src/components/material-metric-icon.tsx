import { MaterialIcon, type MaterialIconName } from './material-icon';
const icons: Record<string, MaterialIconName> = {
  'dumbbell.fill': 'fitness-center',
  gearshape: 'settings',
  'gearshape.fill': 'settings',
  'heart.text.square.fill': 'chat-bubble-outline',
  'arrow.up': 'arrow-upward',
  'chevron.right': 'chevron-right',
  clock: 'history',
  'list.bullet.clipboard': 'assignment',
  magnifyingglass: 'search',
  'shield.lefthalf.filled': 'verified-user',
  trash: 'delete-outline',
  'xmark.circle.fill': 'cancel',
  'bed.double.fill': 'bedtime',
  'bolt.heart.fill': 'monitor-heart',
  'chair.lounge.fill': 'weekend',
  'cross.case.fill': 'medical-services',
  'drop.fill': 'water-drop',
  'figure.pool.swim': 'pool',
  'figure.run': 'directions-run',
  'figure.stairs': 'stairs',
  'figure.walk': 'directions-walk',
  flame: 'local-fire-department',
  'flame.circle': 'local-fire-department',
  'flame.fill': 'local-fire-department',
  'fork.knife': 'restaurant',
  heart: 'favorite-border',
  'heart.circle': 'favorite-border',
  'heart.fill': 'favorite',
  'location.fill': 'near-me',
  'lungs.fill': 'air',
  'mountain.2.fill': 'terrain',
  percent: 'percent',
  'scalemass.fill': 'monitor-weight',
  speedometer: 'speed',
  'thermometer.medium': 'thermostat',
  timer: 'timer',
  'waveform.path.ecg': 'monitor-heart',
  wind: 'air',
  'mic.fill': 'mic',
  'stop.fill': 'stop',
};
export function MetricIcon({
  icon,
  size = 20,
  color,
}: {
  icon: string;
  glyph: string;
  size?: number;
  color: string;
}) {
  return <MaterialIcon name={icons[icon] ?? 'insights'} size={size} color={color} />;
}
