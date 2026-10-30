import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOOKUP_IDS } from '../../src/lib/lookupCache';
import { prisma } from '../../src/db';
import { readCryptoChangePercent24h, writeCryptoChangePercent24h } from '../../src/modules/crypto/cryptoEventStore';
import { ingestSpotQuote, resetPublishedPricesForTests } from '../../src/modules/crypto/cryptoQuotes';

afterEach(() => {
  vi.restoreAllMocks();
  resetPublishedPricesForTests();
  delete LOOKUP_IDS.EVENT_CATEGORY;
});

describe('cryptoEventStore', () => {
  it('reads and writes changePercent24h on Event (not CryptoEvent)', async () => {
    LOOKUP_IDS.EVENT_CATEGORY = { CRYPTO: 9 };
    const findFirst = vi.spyOn(prisma.event, 'findFirst').mockResolvedValue({ id: 42, changePercent24h: 1.25 } as never);
    const update = vi.spyOn(prisma.event, 'update').mockResolvedValue({} as never);

    await writeCryptoChangePercent24h('BTC', 1.25);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ symbol: 'BTC', isDeleted: 0, categoryId: 9 }),
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { changePercent24h: 1.25 },
    });

    await expect(readCryptoChangePercent24h('BTC')).resolves.toBe(1.25);
  });

  it('ingests a spot quote into PriceHistory and updates Event change percent', async () => {
    LOOKUP_IDS.EVENT_CATEGORY = { CRYPTO: 9 };
    const create = vi.spyOn(prisma.priceHistory, 'create').mockResolvedValue({} as never);
    const findPrice = vi.spyOn(prisma.priceHistory, 'findFirst').mockResolvedValue(null);
    const findEvent = vi.spyOn(prisma.event, 'findFirst').mockResolvedValue({ id: 7 } as never);
    const update = vi.spyOn(prisma.event, 'update').mockResolvedValue({} as never);

    const changed = await ingestSpotQuote(
      { symbol: 'BTC', marketSymbol: 'BTCUSDT', price: 81541.1, changePercent24h: 2.12, provider: 'bybit' },
      new Date('2026-10-28T12:00:00.000Z'),
      false,
    );

    expect(changed).toBe(true);
    expect(findPrice).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: { symbol: 'BTC', timestamp: new Date('2026-10-28T12:00:00.000Z'), price: 81541.1 },
    });
    expect(findEvent).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { changePercent24h: 2.12 },
    });
  });
});
