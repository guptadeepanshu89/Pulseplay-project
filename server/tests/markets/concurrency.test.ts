import { describe, expect, it } from 'vitest';

import { LOOKUP_IDS } from '../../src/lib/lookupCache';
import { runSportsTick } from '../../src/workers/sportsTicker';
import { adminSession, api, bearer, loginToken, signInAdmin, withCookie } from '../helpers/app';
import { prisma } from '../helpers/db';
import { betLeg, createOpenMarket, createUser, createUserWithWallet } from '../helpers/factories';

const settle = (cookie: string, marketId: number, winningSelectionId: number) =>
  api().post(`/api/v1/admin/markets/${marketId}/settle`).set(withCookie(cookie)).send({ winningSelectionId });

describe('market suspend, resume, and settlement races', () => {
  it('suspends an open market and rejects a new bet', async () => {
    const cookie = await signInAdmin();
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);

    const suspended = await api().post(`/api/v1/admin/markets/${market.id}/suspend`).set(withCookie(cookie));
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe('SUSPENDED');

    const bet = await api().post('/api/v1/bets').set(bearer(token)).send({ selections: [betLeg(event, market, selections[0])], stake: 10 });
    expect(bet.status).toBe(409);

    const resumed = await api().post(`/api/v1/admin/markets/${market.id}/resume`).set(withCookie(cookie));
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe('OPEN');
  });

  it('rejects suspend and resume from a client admin', async () => {
    const admin = await createUser({ role: 'CLIENT_ADMIN' });
    const cookie = await adminSession(admin.email, 'password123');
    const { market } = await createOpenMarket();
    const suspended = await api().post(`/api/v1/admin/markets/${market.id}/suspend`).set(withCookie(cookie));
    expect(suspended.status).toBe(403);
  });

  it('does not resume a settled market', async () => {
    const cookie = await signInAdmin();
    const { market, selections } = await createOpenMarket();
    expect((await settle(cookie, market.id, selections[0].id)).status).toBe(200);
    const resumed = await api().post(`/api/v1/admin/markets/${market.id}/resume`).set(withCookie(cookie));
    expect(resumed.status).toBe(409);
    expect(resumed.body.code).toBe('NOT_RESUMABLE');
  });

  it('credits a winning bet once when settlement is submitted twice at the same time', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket([2, 3]);
    const token = await loginToken(user.email);
    await api().post('/api/v1/bets').set(bearer(token)).send({ selections: [betLeg(event, market, selections[0])], stake: 100 });

    const [first, second] = await Promise.all([
      settle(cookie, market.id, selections[0].id),
      settle(cookie, market.id, selections[0].id),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(1100);
    expect(wallet.lockedBalance.toNumber()).toBe(0);
    const settlements = await prisma.walletLedger.count({
      where: { userId: user.id, transactionTypeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_SETTLEMENT },
    });
    expect(settlements).toBe(1);
  });

  it('does not leave an open bet when placement races settlement', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket([2, 3]);
    const token = await loginToken(user.email);

    const [bet, settled] = await Promise.all([
      api().post('/api/v1/bets').set(bearer(token)).send({ selections: [betLeg(event, market, selections[0])], stake: 100 }),
      settle(cookie, market.id, selections[0].id),
    ]);
    expect([201, 409]).toContain(bet.status);
    expect(settled.status).toBe(200);

    const open = await prisma.bet.count({
      where: { userId: user.id, statusId: LOOKUP_IDS.BET_STATUS.OPEN, selections: { some: { marketId: market.id } } },
    });
    expect(open).toBe(0);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.lockedBalance.toNumber()).toBe(0);
    expect([1000, 1100]).toContain(wallet.availableBalance.toNumber());
  });

  it('rejects bets on closed and settled markets and leaves the wallet unchanged', async () => {
    const { user } = await createUserWithWallet(1000);
    const token = await loginToken(user.email);
    const closed = await createOpenMarket();
    const settled = await createOpenMarket();
    await prisma.market.update({ where: { id: closed.market.id }, data: { statusId: LOOKUP_IDS.MARKET_STATUS.CLOSED } });
    await prisma.market.update({
      where: { id: settled.market.id },
      data: { statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED, winningSelectionId: settled.selections[0].id },
    });

    const closedBet = await api()
      .post('/api/v1/bets')
      .set(bearer(token))
      .send({ selections: [betLeg(closed.event, closed.market, closed.selections[0])], stake: 10 });
    const settledBet = await api()
      .post('/api/v1/bets')
      .set(bearer(token))
      .send({ selections: [betLeg(settled.event, settled.market, settled.selections[0])], stake: 10 });

    expect(closedBet.status).toBe(409);
    expect(settledBet.status).toBe(409);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(1000);
    expect(wallet.lockedBalance.toNumber()).toBe(0);
    expect(await prisma.bet.count()).toBe(0);
  });

  it('does not change prices on a suspended market when the sports ticker runs', async () => {
    const { market, selections } = await createOpenMarket([2.5, 3.5]);
    await prisma.market.update({ where: { id: market.id }, data: { statusId: LOOKUP_IDS.MARKET_STATUS.SUSPENDED } });
    const before = selections[0].currentPrice.toNumber();

    await runSportsTick();

    const after = await prisma.marketSelection.findUniqueOrThrow({ where: { id: selections[0].id } });
    expect(after.currentPrice.toNumber()).toBe(before);
  });
});
