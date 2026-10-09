import { describe, expect, it } from 'vitest';

import { api, bearer, loginToken, signInAdmin, withCookie } from '../helpers/app';
import { prisma } from '../helpers/db';
import { betLeg, createOpenMarket, createUserWithWallet } from '../helpers/factories';

// Characterization of the fund-request flow as it works today. (Approving a
// DECREASE with insufficient funds is deliberately absent: today it can push
// a wallet negative — a defect the plan fixes, not behaviour to preserve.)

const requestFunds = (token: string, body: Record<string, unknown>) =>
  api().post('/api/v1/wallet/requests').set(bearer(token)).send(body);

const approve = (cookie: string, id: number) => api().post(`/api/v1/admin/wallet-requests/${id}/approve`).set(withCookie(cookie));
const reject = (cookie: string, id: number) => api().post(`/api/v1/admin/wallet-requests/${id}/reject`).set(withCookie(cookie));

async function setup() {
  const { user } = await createUserWithWallet(1000);
  const cookie = await signInAdmin();
  const token = await loginToken(user.email);
  return { user, token, cookie };
}

describe('BT — fund requests', () => {
  it('BT-11 a user creates a PENDING request', async () => {
    const { token } = await setup();

    const res = await requestFunds(token, { type: 'INCREASE', amount: 5000, reason: 'Bonus credit' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'INCREASE', amount: 5000, reason: 'Bonus credit', status: 'PENDING' });
  });

  it('BT-12 rejects invalid requests (bad type, zero amount, missing reason)', async () => {
    const { token } = await setup();

    expect((await requestFunds(token, { type: 'GIFT', amount: 10, reason: 'x' })).status).toBe(400);
    expect((await requestFunds(token, { type: 'INCREASE', amount: 0, reason: 'x' })).status).toBe(400);
    expect((await requestFunds(token, { type: 'INCREASE', amount: 10 })).status).toBe(400);
    expect(await prisma.walletRequest.count()).toBe(0);
  });

  it('BT-13 approving an INCREASE credits the wallet and writes txn, ledger, notification', async () => {
    const { user, token, cookie } = await setup();
    const created = await requestFunds(token, { type: 'INCREASE', amount: 5000, reason: 'Bonus credit' });

    const res = await approve(cookie, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(6000);

    const txn = await prisma.walletTransaction.findFirstOrThrow({
      where: { userId: user.id },
      include: { Lookup_WalletTransaction_typeIdToLookup: true },
    });
    expect(txn.Lookup_WalletTransaction_typeIdToLookup.code).toBe('ADMIN_CREDIT');
    expect(txn.amount.toNumber()).toBe(5000);
    const ledger = await prisma.walletLedger.findFirstOrThrow({ where: { userId: user.id } });
    expect(ledger.beforeAvailable.toNumber()).toBe(1000);
    expect(ledger.afterAvailable.toNumber()).toBe(6000);
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: user.id }, include: { Lookup: true } });
    expect(notification.Lookup.code).toBe('WALLET_APPROVED');
  });

  it('BT-14 approving twice is rejected and credits only once', async () => {
    const { user, token, cookie } = await setup();
    const created = await requestFunds(token, { type: 'INCREASE', amount: 5000, reason: 'Bonus credit' });

    expect((await approve(cookie, created.body.id)).status).toBe(200);
    expect((await approve(cookie, created.body.id)).status).toBe(409);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(6000);
  });

  it('BT-15 rejecting leaves the wallet alone; a rejected request cannot then be approved', async () => {
    const { user, token, cookie } = await setup();
    const created = await requestFunds(token, { type: 'INCREASE', amount: 5000, reason: 'Bonus credit' });

    const res = await reject(cookie, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect((await approve(cookie, created.body.id)).status).toBe(409);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(1000);
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: user.id }, include: { Lookup: true } });
    expect(notification.Lookup.code).toBe('WALLET_REJECTED');
  });
});

describe('BT — a user only ever sees their own data', () => {
  it('BT-16 wallet, requests, transactions, notifications, bets are per-user; other users\' bet ids are 404', async () => {
    const alice = await createUserWithWallet(1000);
    const bob = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket();
    const aliceToken = await loginToken(alice.user.email);
    const bobToken = await loginToken(bob.user.email);

    await requestFunds(aliceToken, { type: 'INCREASE', amount: 100, reason: 'a' });
    const aliceBet = await api()
      .post('/api/v1/bets')
      .set(bearer(aliceToken))
      .send({ selections: [betLeg(event, market, selections[0])], stake: 50 });

    const bobRequests = await api().get('/api/v1/wallet/requests').set(bearer(bobToken));
    const bobBets = await api().get('/api/v1/bets').set(bearer(bobToken));
    const bobTransactions = await api().get('/api/v1/wallet/transactions').set(bearer(bobToken));
    const bobNotifications = await api().get('/api/v1/notifications').set(bearer(bobToken));
    const bobWallet = await api().get('/api/v1/wallet').set(bearer(bobToken));

    expect(bobRequests.body).toEqual([]);
    expect(bobBets.body).toEqual([]);
    expect(bobTransactions.body).toEqual([]);
    expect(bobNotifications.body).toEqual([]);
    expect(bobWallet.body).toMatchObject({ availableBalance: 1000, lockedBalance: 0 });
    expect((await api().get(`/api/v1/bets/${aliceBet.body.id}`).set(bearer(bobToken))).status).toBe(404);
    expect((await api().get(`/api/v1/bets/${aliceBet.body.id}`).set(bearer(aliceToken))).status).toBe(200);
  });
});
