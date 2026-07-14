export type FitnessProviderId = 'google-health' | 'garmin' | 'strava';

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
    id: 'google-health',
    name: 'Google Health',
    detail: 'Fitbit, Pixel Watch, and connected health apps',
    statusLabel: 'Available',
    availability: 'available',
    actionLabel: 'Open Health',
    infoUrl: 'https://developers.google.com/health',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    detail: 'Activity import requires Garmin partner approval and issued credentials',
    statusLabel: 'Partner approval',
    availability: 'approval-required',
    actionLabel: 'Partner details',
    infoUrl: 'https://developer.garmin.com/gc-developer-program/activity-api/',
  },
  {
    id: 'strava',
    name: 'Strava',
    detail: 'Kept separate while multi-provider and AI compatibility is reviewed',
    statusLabel: 'Policy review',
    availability: 'policy-review',
    actionLabel: 'Review policy',
    infoUrl: 'https://www.strava.com/legal/api_policy',
  },
] as const;
