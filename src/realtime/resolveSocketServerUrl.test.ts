import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSocketServerUrl } from './resolveSocketServerUrl';

describe('resolveSocketServerUrl', () => {
  it('uses localhost socket on web when the page is served from this machine', () => {
    const url = resolveSocketServerUrl({
      platform: 'web',
      windowHostname: 'localhost',
      expoPublicApiUrl: 'https://tunnel.example.dev/api/v1',
    });
    assert.equal(url, 'http://localhost:4000');
  });

  it('ignores EXPO_PUBLIC_SOCKET_URL on web localhost (tunnel must not override)', () => {
    const url = resolveSocketServerUrl({
      platform: 'web',
      windowHostname: 'localhost',
      expoPublicSocketUrl: 'https://tunnel.example.dev',
      expoPublicApiUrl: 'https://tunnel.example.dev/api/v1',
    });
    assert.equal(url, 'http://localhost:4000');
  });

  it('uses the configured API origin on web when not on localhost', () => {
    const url = resolveSocketServerUrl({
      platform: 'web',
      windowHostname: '192.168.1.6',
      expoPublicApiUrl: 'http://192.168.1.6:4000/api/v1',
    });
    assert.equal(url, 'http://192.168.1.6:4000');
  });

  it('prefers EXPO_PUBLIC_SOCKET_URL when set', () => {
    const url = resolveSocketServerUrl({
      platform: 'ios',
      expoPublicSocketUrl: 'http://192.168.1.6:4000',
      expoPublicApiUrl: 'http://192.168.1.6:4000/api/v1',
    });
    assert.equal(url, 'http://192.168.1.6:4000');
  });

  it('derives native socket URL from EXPO_PUBLIC_API_URL', () => {
    const url = resolveSocketServerUrl({
      platform: 'android',
      expoPublicApiUrl: 'https://tunnel.example.dev/api/v1',
    });
    assert.equal(url, 'https://tunnel.example.dev');
  });
});
