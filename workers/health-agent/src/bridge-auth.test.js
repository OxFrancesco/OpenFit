import { expect, test } from 'bun:test';
import { requireBearerAuth, requireInternalAuth } from './http';
const env = { HEALTH_AGENT_API_TOKEN: 'legacy-bridge-test', HEALTH_AGENT_CLERK_API_TOKEN: 'clerk-bridge-test' };

test('both existing and Clerk server credentials remain valid', async () => {
  for (const token of Object.values(env)) {
    await requireBearerAuth(new Request('https://example.test', {headers:{Authorization:`Bearer ${token}`}}), env);
    await requireInternalAuth(new Request('https://example.test', {headers:{'X-Fitty-Internal-Token':token}}), env);
  }
});

test('missing and invalid bridge credentials cannot reach the agent', async () => {
  for (const token of ['', 'wrong', 'Bearer']) {
    await expect(requireBearerAuth(new Request('https://example.test', {headers:{Authorization:token}}), env)).rejects.toMatchObject({status:401});
  }
});
