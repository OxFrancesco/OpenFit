export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function isLocalApiBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

export function resolveExplicitApiBaseUrl(
  value: string | undefined,
  platform: string,
  isDev: boolean
) {
  if (!value) {
    return null;
  }

  const normalized = trimTrailingSlash(value);
  if (isLocalApiBaseUrl(normalized)) {
    return platform === 'web' && isDev ? normalized : null;
  }

  return normalized;
}
