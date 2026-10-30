import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { CryptoPriceHistory } from '../types/crypto';
import {
  clearCryptoPriceHistoryCache,
  cryptoPriceHistoryKey,
  loadCachedCryptoPriceHistory,
} from './cryptoPriceHistoryCache';

function sample(price: number): CryptoPriceHistory {
  return {
    points: [{ timestamp: 1, price }],
    currentPrice: price,
    changePercent: 0,
    changeAmount: 0,
    stale: false,
    asOf: 1,
  };
}

afterEach(() => {
  clearCryptoPriceHistoryCache();
});

describe('crypto price history cache', () => {
  it('dedupes concurrent loads for the same symbol and timeframe', async () => {
    let calls = 0;
    const request = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return sample(100);
    };

    const [left, right] = await Promise.all([
      loadCachedCryptoPriceHistory('BTC', '24H', request),
      loadCachedCryptoPriceHistory('btc', '24H', request),
    ]);

    assert.equal(calls, 1);
    assert.equal(left.currentPrice, 100);
    assert.equal(right.currentPrice, 100);
    assert.equal(cryptoPriceHistoryKey('btc', '24H'), 'BTC:24H');
  });

  it('reuses cache for BTC and keeps ETH isolated', async () => {
    let calls = 0;
    const requestFor = (price: number) => async () => {
      calls += 1;
      return sample(price);
    };

    await loadCachedCryptoPriceHistory('BTC', '24H', requestFor(100));
    await loadCachedCryptoPriceHistory('BTC', '24H', requestFor(100));
    await loadCachedCryptoPriceHistory('ETH', '24H', requestFor(2000));

    assert.equal(calls, 2);
  });

  it('bypassCache forces another request', async () => {
    let calls = 0;
    const request = async () => {
      calls += 1;
      return sample(calls);
    };

    await loadCachedCryptoPriceHistory('BTC', '1W', request);
    await loadCachedCryptoPriceHistory('BTC', '1W', request, { bypassCache: true });
    assert.equal(calls, 2);
  });
});
