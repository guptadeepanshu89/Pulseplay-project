import bcrypt from 'bcryptjs';

import { prisma } from './db';
import { env } from './env';
import { loadLookupCache, LOOKUP_IDS } from './lib/lookupCache';
import { loadRoleCache, ROLE_IDS } from './lib/roleCache';

const DEMO_PASSWORD = 'password123';
// Dev-only logins for the admin roles (meets the ≥10 chars, letters+digits password policy).
const DEMO_ADMIN_PASSWORD = 'DemoAdmin123';
const SUPER_ADMIN_EMAIL = 'admin@pulseplay.local';

function findSelection(selections: { id: number; code: string }[], code: string): number {
  const match = selections.find((selection) => selection.code === code);
  if (!match) throw new Error(`Seed error: selection code ${code} not found`);
  return match.id;
}

async function main() {
  // Lookup/LookupType rows come from a migration (prisma/migrations/*_seed_lookup_reference_data),
  // not from this script — run `npx prisma migrate deploy` (or `migrate dev`) first.
  await loadLookupCache();
  await loadRoleCache();

  console.log('Wiping existing data...');
  await prisma.betSelectionLeg.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.walletLedger.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.walletRequest.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.marketSelection.deleteMany();
  await prisma.market.deleteMany();
  await prisma.event.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.user.deleteMany();
  // The DEMO client comes from the RBAC migration and is kept; anything else is dev clutter.
  await prisma.client.deleteMany({ where: { code: { not: 'DEMO' } } });

  console.log('Seeding demo client + users...');
  const client = await prisma.client.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { code: 'DEMO', name: 'Demo Client' },
  });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptCost);
  const adminPasswordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, env.bcryptCost);

  // SUPER_ADMIN belongs to no client (a DB trigger enforces that). Real deployments
  // create theirs with `npm run create-superadmin`; this one is for local dev only.
  await prisma.user.create({
    data: {
      name: 'System Admin',
      userCode: 'ID#ADMIN',
      email: SUPER_ADMIN_EMAIL,
      mobile: '0000000000',
      passwordHash: adminPasswordHash,
      roleId: ROLE_IDS.SUPER_ADMIN,
    },
  });
  await prisma.user.create({
    data: {
      name: 'Demo Client Admin',
      userCode: 'ID#CADMIN',
      email: 'client.admin@example.com',
      mobile: '0000000001',
      passwordHash: adminPasswordHash,
      roleId: ROLE_IDS.CLIENT_ADMIN,
      clientId: client.id,
    },
  });
  const user = await prisma.user.create({
    data: {
      name: 'Rohan Kumar',
      userCode: 'ID#10245',
      email: 'rohan.kumar@example.com',
      mobile: '9876543210',
      passwordHash,
      roleId: ROLE_IDS.CLIENT_USER,
      clientId: client.id,
    },
  });

  console.log('Seeding wallet...');
  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      currency: 'INR',
      availableBalance: 18560.5,
      lockedBalance: 6000,
      statusId: LOOKUP_IDS.WALLET_STATUS.ACTIVE,
    },
  });

  console.log('Seeding events...');
  const evtIndiaVsAustralia = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRICKET,
      name: 'India vs Australia',
      competition: 'T20 World Cup',
      startTime: new Date('2026-08-15T14:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      scoreLabel: '124/3',
      minuteLabel: 'Over 12.4',
      homeTeamName: 'India',
      homeTeamShort: 'IND',
      homeScore: '124',
      awayTeamName: 'Australia',
      awayTeamShort: 'AUS',
    },
  });
  const evtManCityVsRealMadrid = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL,
      name: 'Man City vs Real Madrid',
      competition: 'UEFA Champions League',
      startTime: new Date('2026-08-15T18:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      scoreLabel: '1-0',
      minuteLabel: "56'",
      homeTeamName: 'Man City',
      homeTeamShort: 'MCI',
      homeScore: '1',
      awayTeamName: 'Real Madrid',
      awayTeamShort: 'RMA',
      awayScore: '0',
    },
  });
  await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL,
      name: 'Liverpool vs Chelsea',
      competition: 'Premier League',
      startTime: new Date('2026-08-15T17:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      scoreLabel: '2-1',
      minuteLabel: "68'",
      homeTeamName: 'Liverpool',
      homeTeamShort: 'LIV',
      homeScore: '2',
      awayTeamName: 'Chelsea',
      awayTeamShort: 'CHE',
      awayScore: '1',
    },
  });
  await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL,
      name: 'Barcelona vs Sevilla',
      competition: 'La Liga',
      startTime: new Date('2026-08-15T19:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      scoreLabel: '3-1',
      minuteLabel: "74'",
      homeTeamName: 'Barcelona',
      homeTeamShort: 'BAR',
      homeScore: '3',
      awayTeamName: 'Sevilla',
      awayTeamShort: 'SEV',
      awayScore: '1',
    },
  });
  const evtArsenalVsTottenham = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL,
      name: 'Arsenal vs Tottenham',
      competition: 'Premier League',
      startTime: new Date('2026-08-16T20:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.SCHEDULED,
      homeTeamName: 'Arsenal',
      homeTeamShort: 'ARS',
      awayTeamName: 'Tottenham',
      awayTeamShort: 'TOT',
    },
  });
  await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL,
      name: 'PSG vs Marseille',
      competition: 'Ligue 1',
      startTime: new Date('2026-08-17T19:30:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.SCHEDULED,
      homeTeamName: 'PSG',
      homeTeamShort: 'PSG',
      awayTeamName: 'Marseille',
      awayTeamShort: 'MAR',
    },
  });
  const evtBitcoin = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRYPTO,
      name: 'Bitcoin (BTC)',
      competition: 'Crypto Markets',
      startTime: new Date('2026-08-15T00:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      symbol: 'BTC',
    },
  });
  await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRYPTO,
      name: 'Ethereum (ETH)',
      competition: 'Crypto Markets',
      startTime: new Date('2026-08-15T00:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      symbol: 'ETH',
    },
  });
  const evtElection = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.ELECTION,
      name: 'National Election 2026',
      competition: 'National Election',
      startTime: new Date('2026-11-05T00:00:00Z'),
      statusId: LOOKUP_IDS.EVENT_STATUS.SCHEDULED,
    },
  });

  console.log('Seeding markets + selections...');
  const OPEN_MARKET = LOOKUP_IDS.MARKET_STATUS.OPEN;
  const SUSPENDED_MARKET = LOOKUP_IDS.MARKET_STATUS.SUSPENDED;

  const mktIndiaMatchWinner = await prisma.market.create({
    data: {
      eventId: evtIndiaVsAustralia.id,
      marketType: 'MATCH_WINNER',
      name: 'Match Winner',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'IND', name: 'India', currentPrice: 1.8, priceVersion: 3, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'AUS', name: 'Australia', currentPrice: 2.1, priceVersion: 3, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
    include: { selections: true },
  });
  const mktIndiaTotalRuns = await prisma.market.create({
    data: {
      eventId: evtIndiaVsAustralia.id,
      marketType: 'OVER_TOTAL_RUNS',
      name: '2 Over Total Runs >= 30',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'YES', name: 'Yes', currentPrice: 1.8, priceVersion: 2, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'NO', name: 'No', currentPrice: 1.9, priceVersion: 2, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
    include: { selections: true },
  });
  const mktManCityMatchWinner = await prisma.market.create({
    data: {
      eventId: evtManCityVsRealMadrid.id,
      marketType: 'MATCH_WINNER',
      name: 'Match Winner',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'HOME', name: 'Man City', currentPrice: 1.65, priceVersion: 4, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'DRAW', name: 'Draw', currentPrice: 3.8, priceVersion: 4, statusId: OPEN_MARKET, sortOrder: 1 },
          { code: 'AWAY', name: 'Real Madrid', currentPrice: 5.5, priceVersion: 4, statusId: OPEN_MARKET, sortOrder: 2 },
        ],
      },
    },
    include: { selections: true },
  });
  const mktManCityTotalGoals = await prisma.market.create({
    data: {
      eventId: evtManCityVsRealMadrid.id,
      marketType: 'TOTAL_GOALS',
      name: 'Total Goals',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'OVER_2_5', name: 'Over 2.5', currentPrice: 1.9, priceVersion: 2, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'UNDER_2_5', name: 'Under 2.5', currentPrice: 1.9, priceVersion: 2, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
    include: { selections: true },
  });
  await prisma.market.create({
    data: {
      eventId: evtManCityVsRealMadrid.id,
      marketType: 'NEXT_GOAL',
      name: 'Next Goal (2nd Half)',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'HOME', name: 'Man City', currentPrice: 1.7, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'NONE', name: 'No Goal', currentPrice: 4.0, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 1 },
          { code: 'AWAY', name: 'Real Madrid', currentPrice: 2.2, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 2 },
        ],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtManCityVsRealMadrid.id,
      marketType: 'BOTH_TEAMS_TO_SCORE',
      name: 'Both Teams to Score',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'YES', name: 'Yes', currentPrice: 1.75, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'NO', name: 'No', currentPrice: 2.05, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtBitcoin.id,
      marketType: 'PRICE_AT_TIMESTAMP',
      name: 'Will BTC be above $60,000 tomorrow 12:00 PM?',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'YES', name: 'Yes', currentPrice: 1.8, priceVersion: 5, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'NO', name: 'No', currentPrice: 2.1, priceVersion: 5, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtBitcoin.id,
      marketType: 'PRICE_RANGE',
      name: '$65,000 - $68,000 tomorrow',
      statusId: SUSPENDED_MARKET,
      selections: {
        create: [{ code: 'IN_RANGE', name: 'In range', currentPrice: 1.6, priceVersion: 2, statusId: OPEN_MARKET, sortOrder: 0 }],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtElection.id,
      marketType: 'OFFICIAL_WINNER',
      name: 'Winner of Election',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'CAND_A', name: 'Candidate A', currentPrice: 1.7, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'CAND_B', name: 'Candidate B', currentPrice: 2.2, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtElection.id,
      marketType: 'PARTY_WINNER',
      name: 'Which Party Will Win',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'PARTY_A', name: 'Unity Party', currentPrice: 1.75, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'PARTY_B', name: 'Progress Party', currentPrice: 2.05, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
  });
  await prisma.market.create({
    data: {
      eventId: evtElection.id,
      marketType: 'VOTER_TURNOUT',
      name: 'Will Voter Turnout Exceed 60%?',
      statusId: OPEN_MARKET,
      selections: {
        create: [
          { code: 'YES', name: 'Yes', currentPrice: 1.9, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 0 },
          { code: 'NO', name: 'No', currentPrice: 1.9, priceVersion: 1, statusId: OPEN_MARKET, sortOrder: 1 },
        ],
      },
    },
  });

  console.log('Seeding bets...');
  await prisma.bet.create({
    data: {
      userId: user.id,
      clientId: client.id,
      stake: 500,
      combinedOdds: 1.8,
      potentialReturn: 900,
      statusId: LOOKUP_IDS.BET_STATUS.WON,
      legCount: 1,
      placedAt: new Date('2026-08-15T07:50:00Z'),
      settledAt: new Date('2026-08-15T08:15:00Z'),
      selections: {
        create: [
          {
            eventId: evtIndiaVsAustralia.id,
            eventName: 'India vs Australia',
            marketId: mktIndiaMatchWinner.id,
            marketName: 'Match Winner',
            selectionId: findSelection(mktIndiaMatchWinner.selections, 'IND'),
            selectionName: 'India',
            oddsAtPlacement: 1.8,
          },
        ],
      },
    },
  });
  await prisma.bet.create({
    data: {
      userId: user.id,
      clientId: client.id,
      stake: 500,
      combinedOdds: 3.14,
      potentialReturn: 1570,
      statusId: LOOKUP_IDS.BET_STATUS.OPEN,
      legCount: 2,
      placedAt: new Date('2026-08-15T08:30:00Z'),
      selections: {
        create: [
          {
            eventId: evtManCityVsRealMadrid.id,
            eventName: 'Man City vs Real Madrid',
            marketId: mktManCityMatchWinner.id,
            marketName: 'Match Winner',
            selectionId: findSelection(mktManCityMatchWinner.selections, 'HOME'),
            selectionName: 'Man City',
            oddsAtPlacement: 1.65,
          },
          {
            eventId: evtManCityVsRealMadrid.id,
            eventName: 'Man City vs Real Madrid',
            marketId: mktManCityTotalGoals.id,
            marketName: 'Total Goals',
            selectionId: findSelection(mktManCityTotalGoals.selections, 'OVER_2_5'),
            selectionName: 'Over 2.5',
            oddsAtPlacement: 1.9,
          },
        ],
      },
    },
  });
  await prisma.bet.create({
    data: {
      userId: user.id,
      clientId: client.id,
      stake: 300,
      combinedOdds: 1.9,
      potentialReturn: 570,
      statusId: LOOKUP_IDS.BET_STATUS.LOST,
      legCount: 1,
      placedAt: new Date('2026-07-09T08:40:00Z'),
      settledAt: new Date('2026-07-09T09:10:00Z'),
      selections: {
        create: [
          {
            eventId: evtIndiaVsAustralia.id,
            eventName: 'India vs Australia',
            marketId: mktIndiaTotalRuns.id,
            marketName: '2 Over Total Runs >= 30',
            selectionId: findSelection(mktIndiaTotalRuns.selections, 'NO'),
            selectionName: 'No',
            oddsAtPlacement: 1.9,
          },
        ],
      },
    },
  });
  await prisma.bet.create({
    data: {
      userId: user.id,
      clientId: client.id,
      stake: 200,
      combinedOdds: 2.1,
      potentialReturn: 420,
      statusId: LOOKUP_IDS.BET_STATUS.VOID,
      legCount: 1,
      placedAt: new Date('2026-06-01T10:00:00Z'),
      settledAt: new Date('2026-06-02T09:00:00Z'),
      selections: {
        create: [
          {
            // selectionId intentionally points at mktManCityMatchWinner's HOME selection —
            // BetSelectionLeg.selectionId is an unconstrained historical snapshot value (no
            // FK), and this mismatch vs. selectionName below was already present in the
            // original mock data this seed reproduces, not introduced here.
            eventId: evtArsenalVsTottenham.id,
            eventName: 'Arsenal vs Tottenham',
            marketId: mktManCityMatchWinner.id,
            marketName: 'Match Winner',
            selectionId: findSelection(mktManCityMatchWinner.selections, 'HOME'),
            selectionName: 'Arsenal',
            oddsAtPlacement: 2.1,
          },
        ],
      },
    },
  });

  console.log('Seeding wallet transactions...');
  const txnStatusCompleted = LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED;
  await prisma.walletTransaction.createMany({
    data: [
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_SETTLEMENT, amount: 1250, statusId: txnStatusCompleted, createdAt: new Date('2026-08-15T08:15:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_LOCK, amount: -500, statusId: txnStatusCompleted, createdAt: new Date('2026-08-15T08:30:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADMIN_CREDIT, amount: 5000, statusId: txnStatusCompleted, createdAt: new Date('2026-08-15T20:45:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADMIN_DEBIT, amount: -2000, statusId: txnStatusCompleted, createdAt: new Date('2026-08-14T19:20:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADJUSTMENT, amount: 1000, statusId: txnStatusCompleted, createdAt: new Date('2026-08-01T10:30:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_SETTLEMENT, amount: -500, statusId: txnStatusCompleted, createdAt: new Date('2026-07-09T09:10:00Z') },
      { walletId: wallet.id, userId: user.id, typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADMIN_CREDIT, amount: 2000, statusId: txnStatusCompleted, createdAt: new Date('2026-04-30T20:20:00Z') },
    ],
  });

  console.log('Seeding wallet requests...');
  await prisma.walletRequest.createMany({
    data: [
      { walletId: wallet.id, userId: user.id, clientId: client.id, typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE.INCREASE, amount: 5000, reason: 'Bonus credit', statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING, requestedAt: new Date('2026-08-15T10:00:00Z') },
      { walletId: wallet.id, userId: user.id, clientId: client.id, typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE.DECREASE, amount: 2000, reason: 'Manual adjustment', statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING, requestedAt: new Date('2026-08-14T19:20:00Z') },
      { walletId: wallet.id, userId: user.id, clientId: client.id, typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE.INCREASE, amount: 1000, reason: 'Promotional adjustment', statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.APPROVED, requestedAt: new Date('2026-08-01T10:30:00Z'), resolvedAt: new Date('2026-08-01T11:10:00Z') },
      { walletId: wallet.id, userId: user.id, clientId: client.id, typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE.DECREASE, amount: 500, reason: 'Rule violation penalty', statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.REJECTED, requestedAt: new Date('2026-04-30T20:20:00Z'), resolvedAt: new Date('2026-04-30T21:00:00Z') },
    ],
  });

  console.log('Seeding notifications...');
  await prisma.notification.createMany({
    data: [
      { userId: user.id, typeId: LOOKUP_IDS.NOTIFICATION_TYPE.BET_SETTLED, title: 'You Won!', message: "You've won ₹1,250.00 on India vs Australia", read: false, createdAt: new Date('2026-08-15T08:15:00Z') },
      { userId: user.id, typeId: LOOKUP_IDS.NOTIFICATION_TYPE.WALLET_APPROVED, title: 'Deposit Approved', message: 'Your deposit of ₹5,000.00 was approved', read: false, createdAt: new Date('2026-08-15T20:45:00Z') },
      { userId: user.id, typeId: LOOKUP_IDS.NOTIFICATION_TYPE.BET_PLACED, title: 'Bet Placed', message: 'Your bet on Man City has been placed successfully', read: true, createdAt: new Date('2026-08-15T08:30:00Z') },
      { userId: user.id, typeId: LOOKUP_IDS.NOTIFICATION_TYPE.WALLET_APPROVED, title: 'Permission Request Approved', message: 'Your request of ₹1,000.00 was approved', read: true, createdAt: new Date('2026-08-01T10:30:00Z') },
      { userId: user.id, typeId: LOOKUP_IDS.NOTIFICATION_TYPE.ACCOUNT_ALERT, title: 'System Alert', message: 'Scheduled maintenance on 20 Aug, 02:00 - 03:00 AM', read: true, createdAt: new Date('2026-08-14T09:00:00Z') },
    ],
  });

  console.log(`Seed complete. Player login: ${user.email} / ${DEMO_PASSWORD}`);
  console.log(`Admin logins (password ${DEMO_ADMIN_PASSWORD}): ${SUPER_ADMIN_EMAIL} (SUPER_ADMIN), client.admin@example.com (CLIENT_ADMIN)`);
  console.log('Note: the 2-leg accumulator bet is intentionally left OPEN forever by');
  console.log('POST /admin/markets/:id/settle, which only settles single-selection bets in this pass.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
