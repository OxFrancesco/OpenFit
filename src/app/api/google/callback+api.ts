import {
  getConfiguredGoogleCallbackUri,
  getGoogleAppReturnUri,
  getGoogleCallbackUri,
} from '@/lib/google-oauth-server';

function buildAppRedirect(params: Record<string, string>) {
  const url = new URL(getGoogleAppReturnUri());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function buildStateAppRedirect(state: string | null, params: Record<string, string>) {
  const url = new URL(getAllowedAppReturnUriFromState(state) ?? getGoogleAppReturnUri());

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appRedirectResponse(url: URL) {
  const target = url.toString();
  const safeTarget = escapeHtml(target);
  const jsTarget = JSON.stringify(target).replaceAll('<', '\\u003c');

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening OpenFit</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f7;
      color: #111;
    }
    main {
      width: min(28rem, calc(100vw - 2rem));
      text-align: center;
    }
    a {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.875rem 1.25rem;
      border-radius: 999px;
      background: #111;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    p { color: #666; line-height: 1.45; }
    @media (prefers-color-scheme: dark) {
      body { background: #111; color: #f5f5f7; }
      p { color: #aaa; }
      a { background: #f5f5f7; color: #111; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Opening OpenFit...</h1>
    <p>If you are not returned to the app automatically, tap the button below.</p>
    <a href="${safeTarget}">Open OpenFit</a>
  </main>
  <script>
    window.location.replace(${jsTarget});
  </script>
</body>
</html>`,
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
      },
    }
  );
}

function redirectToApp(url: URL) {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return Response.redirect(url, 302);
  }

  return appRedirectResponse(url);
}

function getAllowedAppReturnUriFromState(state: string | null) {
  if (!state) {
    return null;
  }

  const encodedReturnUri = state.slice(state.indexOf('.') + 1);

  if (!encodedReturnUri || encodedReturnUri === state) {
    return null;
  }

  try {
    const returnUri = decodeURIComponent(encodedReturnUri);
    return isAllowedAppReturnUri(returnUri) ? returnUri : null;
  } catch {
    return null;
  }
}

function getOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isAllowedAppReturnUri(returnUri: string) {
  const allowedNativeReturnUris = new Set([
    getGoogleAppReturnUri(),
    'fitty://oauth',
    'com.francescooddo.fitty://oauth',
  ]);

  if (allowedNativeReturnUris.has(returnUri)) {
    return true;
  }

  try {
    const url = new URL(returnUri);
    const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    const allowedWebOrigins = new Set(
      [getOrigin(getGoogleCallbackUri()), getOrigin(getConfiguredGoogleCallbackUri())].filter(
        (origin): origin is string => Boolean(origin)
      )
    );

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    if (allowedWebOrigins.has(url.origin)) {
      return url.pathname === '/' && !url.search && !url.hash;
    }

    return (
      localhostHosts.has(url.hostname) &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError =
    requestUrl.searchParams.get('error_description') ?? requestUrl.searchParams.get('error');

  if (!state) {
    return redirectToApp(
      buildAppRedirect({ error: 'Missing OAuth state from Google callback' }),
    );
  }

  if (oauthError) {
    return redirectToApp(buildStateAppRedirect(state, { state, error: oauthError }));
  }

  if (!code) {
    return redirectToApp(
      buildStateAppRedirect(state, { state, error: 'Missing authorization code from Google callback' }),
    );
  }

  // The app validates the returned state against its locally stored nonce before
  // exchanging the one-time authorization code. Keeping the callback stateless
  // also avoids relying on serverless instance affinity.
  return redirectToApp(buildStateAppRedirect(state, { state, code, status: 'success' }));
}
