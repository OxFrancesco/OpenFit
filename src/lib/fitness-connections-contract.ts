export type ConnectableFitnessProviderId = 'strava' | 'garmin';

export type FitnessConnectionState =
  | 'connected'
  | 'disconnected'
  | 'reauth-required'
  | 'unavailable';

export type FitnessUnavailableReason =
  | 'not-configured'
  | 'approval-required'
  | 'policy-disabled';

export type FitnessConnectionSummary = {
  provider: ConnectableFitnessProviderId;
  state: FitnessConnectionState;
  connectedAt?: string;
  externalAccountLabel?: string;
  grantedScopes: string[];
  unavailableReason?: FitnessUnavailableReason;
  detail?: string;
};

export type FitnessConnectionsResponse = {
  connections: FitnessConnectionSummary[];
};

export type FitnessOAuthStartResponse = {
  authorizationUrl: string;
};

export type FitnessOAuthCompletionParams =
  | {
      provider: ConnectableFitnessProviderId;
      status: 'connected';
      completionId: string;
    }
  | {
      provider: ConnectableFitnessProviderId;
      status: 'cancelled' | 'error';
      error?: string;
    };
