export type FitnessProviderId = 'device-health' | 'garmin' | 'strava';

export type FitnessProvider = {
  id: FitnessProviderId;
  name: string;
  detail: string;
  statusLabel: string;
  availability: 'available' | 'approval-required' | 'policy-review';
  actionLabel: string;
  infoUrl: string;
};

export const FITNESS_PROVIDERS: readonly FitnessProvider[] = [
  {
    id: 'device-health',
    name: 'Device health',
    detail: 'Apple Health on iPhone or Health Connect on Android',
    statusLabel: 'Available',
    availability: 'available',
    actionLabel: 'Open Health',
    infoUrl: 'https://developer.android.com/health-and-fitness/health-connect',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    detail: 'Connection only; activities are not imported. Garmin partner approval is required',
    statusLabel: 'Partner approval',
    availability: 'approval-required',
    actionLabel: 'Partner details',
    infoUrl: 'https://developer.garmin.com/gc-developer-program/activity-api/',
  },
  {
    id: 'strava',
    name: 'Strava',
    detail: 'Connection only; activities are not imported. Written policy clearance is required',
    statusLabel: 'Policy review',
    availability: 'policy-review',
    actionLabel: 'Review policy',
    infoUrl: 'https://www.strava.com/legal/api_policy',
  },
] as const;
