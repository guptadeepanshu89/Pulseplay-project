import { describe, expect, it } from 'vitest';

import { adminSession, api, bearer, loginToken, signInAdmin, withCookie } from '../helpers/app';
import { prisma } from '../helpers/db';
import { betLeg, createAdminUser, createOpenMarket, createUserWithWallet } from '../helpers/factories';

// Characterization tests: they pin down what the system does TODAY for bets
// and settlement, so the role/tenant work can't silently change betting
// maths. Only the auth plumbing around settle changes later; the assertions
// on wallet/ledger/status must keep passing untouched.

async function placeBet(token: string, legs: ReturnType<typeof betLeg>[], stake: number) {
  return api().post('/api/v1/bets').set(bearer(token)).send({ selections: legs, stake });
}

const settle = (cookie: string, marketId: number, winningSelectionId: number) =>
  api().post(`/api/v1/admin/markets/${marketId}/settle`).set(withCookie(cookie)).send({ winningSelectionId });

const walletOf = async (userId: number) => {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return { available: wallet.availableBalance.toNumber(), locked: wallet.lockedBalance.toNumber() };
};

describe('BT — bet placement', () => {
  it('BT-01 places a bet: locks the stake and writes ledger, transaction and notification', async () => {
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket([2.0, 3.0]);
    const token = await loginToken(user.email);

    const res = await placeBet(token, [betLeg(event, market, selections[0])], 100);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'OPEN', stake: 100, combinedOdds: 2, potentialReturn: 200, legCount: 1 });
    expect(await walletOf(user.id)).toEqual({ available: 900, locked: 100 });

    const ledger = await prisma.walletLedger.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].beforeAvailable.toNumber()).toBe(1000);
    expect(ledger[0].afterAvailable.toNumber()).toBe(900);
    expect(ledger[0].beforeLocked.toNumber()).toBe(0);
    expect(ledger[0].afterLocked.toNumber()).toBe(100);
    expect(await prisma.walletTransaction.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it('BT-02 rejects a stake larger than the available balance and changes nothing', async () => {
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);

    const res = await placeBet(token, [betLeg(event, market, selections[0])], 5000);

    expect(res.status).toBe(400);
    expect(await walletOf(user.id)).toEqual({ available: 1000, locked: 0 });
    expect(await prisma.bet.count()).toBe(0);
  });

  it('BT-03 rejects unknown market (404), closed market (409) and selection from another market (404)', async () => {
    const { user } = await createUserWithWallet(1000);
    const first = await createOpenMarket();
    const second = await createOpenMarket();
    const token = await loginToken(user.email);

    const unknown = await placeBet(token, [{ ...betLeg(first.event, first.market, first.selections[0]), marketId: 99999 }], 10);
    expect(unknown.status).toBe(404);

    const mismatched = await placeBet(token, [{ ...betLeg(first.event, first.market, first.selections[0]), selectionId: second.selections[0].id }], 10);
    expect(mismatched.status).toBe(404);

    const suspended = await prisma.lookup.findFirstOrThrow({ where: { code: 'SUSPENDED', lookupType: { code: 'MARKET_STATUS' } } });
    await prisma.market.update({ where: { id: first.market.id }, data: { statusId: suspended.id } });
    const closed = await placeBet(token, [betLeg(first.event, first.market, first.selections[0])], 10);
    expect(closed.status).toBe(409);

    expect(await walletOf(user.id)).toEqual({ available: 1000, locked: 0 });
  });

  it('BT-04 ignores any client-sent price and uses the live server price', async () => {
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket([2.0, 3.0]);
    const token = await loginToken(user.email);

    const res = await api()
      .post('/api/v1/bets')
      .set(bearer(token))
      .send({ selections: [{ ...betLeg(event, market, selections[0]), price: 99 }], stake: 100, price: 99 });

    expect(res.status).toBe(201);
    expect(res.body.combinedOdds).toBe(2);
    expect(res.body.potentialReturn).toBe(200);
  });

  it('BT-05 20 parallel bets against funds for 5: exactly 5 succeed, balance never negative', async () => {
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => placeBet(token, [betLeg(event, market, selections[0])], 200)),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 400)).toHaveLength(15);
    expect(await walletOf(user.id)).toEqual({ available: 0, locked: 1000 });
    expect(await prisma.bet.count()).toBe(5);
  });
});

describe('BT — settlement', () => {
  it('BT-06 winning single bet credits potentialReturn and releases the lock', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket([2.0, 3.0]);
    const token = await loginToken(user.email);
    await placeBet(token, [betLeg(event, market, selections[0])], 100);

    const res = await settle(cookie, market.id, selections[0].id);

    expect(res.status).toBe(200);
    expect(res.body.settledBets).toHaveLength(1);
    expect(res.body.settledBets[0].status).toBe('WON');
    expect(await walletOf(user.id)).toEqual({ available: 1100, locked: 0 });
    expect(await prisma.walletLedger.count({ where: { userId: user.id } })).toBe(2);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(2);
  });

  it('BT-06b losing bet forfeits the stake; potentialReturn floors to 2 dp', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket([1.15, 4.0]);
    const token = await loginToken(user.email);

    const bet = await placeBet(token, [betLeg(event, market, selections[0])], 33.33);
    expect(bet.body.potentialReturn).toBe(38.32); // 33.33 * 1.15 = 38.3295 → floored, not rounded

    await settle(cookie, market.id, selections[1].id); // the other selection wins → our bet loses
    const stored = await prisma.bet.findFirstOrThrow({ include: { status: true } });
    expect(stored.status.code).toBe('LOST');
    expect(await walletOf(user.id)).toEqual({ available: 966.67, locked: 0 });
  });

  it('BT-07 settling twice is rejected and credits only once', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);
    await placeBet(token, [betLeg(event, market, selections[0])], 100);

    expect((await settle(cookie, market.id, selections[0].id)).status).toBe(200);
    expect((await settle(cookie, market.id, selections[0].id)).status).toBe(409);
    expect(await walletOf(user.id)).toEqual({ available: 1100, locked: 0 });
  });

  it('BT-08 bets from two users on one market are each settled into their own wallet', async () => {
    const winner = await createUserWithWallet(1000);
    const loser = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const { event, market, selections } = await createOpenMarket([2.0, 3.0]);

    await placeBet(await loginToken(winner.user.email), [betLeg(event, market, selections[0])], 100);
    await placeBet(await loginToken(loser.user.email), [betLeg(event, market, selections[1])], 50);
    await settle(cookie, market.id, selections[0].id);

    expect(await walletOf(winner.user.id)).toEqual({ available: 1100, locked: 0 });
    expect(await walletOf(loser.user.id)).toEqual({ available: 950, locked: 0 });
  });

  it('BT-09 a multi-leg bet is left OPEN when one of its markets settles (documented cut)', async () => {
    const { user } = await createUserWithWallet(1000);
    const cookie = await signInAdmin();
    const first = await createOpenMarket([2.0, 3.0]);
    const second = await createOpenMarket([2.0, 3.0]);
    const token = await loginToken(user.email);

    const bet = await placeBet(
      token,
      [betLeg(first.event, first.market, first.selections[0]), betLeg(second.event, second.market, second.selections[0])],
      100,
    );
    expect(bet.status).toBe(201);
    expect(bet.body.combinedOdds).toBe(4);

    await settle(cookie, first.market.id, first.selections[0].id);

    const stored = await prisma.bet.findFirstOrThrow({ include: { status: true } });
    expect(stored.status.code).toBe('OPEN');
    expect(await walletOf(user.id)).toEqual({ available: 900, locked: 100 });
  });

  it('BT-10 settle records the acting admin user on the market and its selections', async () => {
    const admin = await createAdminUser();
    const cookie = await adminSession();
    const { market, selections } = await createOpenMarket();

    await settle(cookie, market.id, selections[0].id);

    const settled = await prisma.market.findUniqueOrThrow({ where: { id: market.id }, include: { selections: true } });
    expect(settled.modifiedByUserId).toBe(admin.id);
    expect(settled.selections.every((s) => s.modifiedByUserId === admin.id)).toBe(true);
  });
});
