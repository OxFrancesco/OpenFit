import { describe, expect, test } from 'bun:test';

import { resolveExplicitApiBaseUrl } from './api-base-core.ts';

describe('production API base URL selection', () => {
  test('rejects a local API URL from a production web bundle', () => {
    expect(resolveExplicitApiBaseUrl('http://192.168.1.132:8081', 'web', false)).toBeNull();
  });

  test('allows a local API URL for web development', () => {
    expect(resolveExplicitApiBaseUrl('http://192.168.1.132:8081/', 'web', true)).toBe(
      'http://192.168.1.132:8081'
    );
  });

  test('allows a remote API URL in production', () => {
    expect(resolveExplicitApiBaseUrl('https://avg-francesco-fitty.expo.app/', 'web', false)).toBe(
      'https://avg-francesco-fitty.expo.app'
    );
  });
});
