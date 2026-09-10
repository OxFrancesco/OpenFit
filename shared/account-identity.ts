export class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function accountStorageId(user: unknown, userId: string) {
  if (!user || typeof user !== 'object' || !('id' in user) || user.id !== userId) {
    throw new AccountError(502, 'Could not verify your account.');
  }
  // Preserve existing conversations and fitness connections indexed by the linked Google identity.
  // This is an identifier from Clerk, not a Google token or a requirement for Google sign-in.
  const accounts = 'external_accounts' in user && Array.isArray(user.external_accounts) ? user.external_accounts : [];
  const google = accounts.filter(a => a && a.provider === 'oauth_google' && typeof a.provider_user_id === 'string');
  if (google.length > 1) throw new AccountError(409, 'Multiple Google identities are linked. Contact support to select the existing data account.');
  return google[0]?.provider_user_id ?? userId;
}

export async function storageIdForAccount(secret: string | undefined, userId: string) {
  if (!secret) throw new AccountError(503, 'Account access is not configured.');
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!response.ok) throw new AccountError(503, 'Could not load your account. Please try again.');
  return accountStorageId(await response.json(), userId);
}
