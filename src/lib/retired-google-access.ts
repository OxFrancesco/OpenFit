export function retiredGoogleAccess() {
  return Response.json({ error: 'Google Health cloud access has been retired. Update OpenFit and connect Apple Health or Health Connect on your phone.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
