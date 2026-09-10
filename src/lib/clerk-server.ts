import { verifyToken } from '@clerk/backend';
import { AccountError } from '../../shared/account-identity';

export async function requireClerkUser(request: Request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AccountError(401, 'Sign in to OpenFit first.');
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new AccountError(503, 'Account access is not configured on this server.');
  try {
    const claims = await verifyToken(token, { secretKey });
    const allowedOrigins = [
      'https://avg-francesco-fitty.expo.app',
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:8082', 'http://localhost:8081'] : []),
    ];
    // Native bearer sessions have no browser origin. Validate any origin that is present.
    if (claims.azp && !allowedOrigins.includes(claims.azp)) throw new Error('Untrusted browser origin');
    if (!claims.sub || !claims.sid) throw new Error('Not a user session');
    return claims.sub;
  } catch {
    throw new AccountError(401, 'Your OpenFit session has expired. Sign in again.');
  }
}
