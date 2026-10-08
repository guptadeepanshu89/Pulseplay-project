-- CreateTable
CREATE TABLE "LookupType" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lookup" (
    "id" SERIAL NOT NULL,
    "lookupTypeId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lookup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "passwordHash" TEXT NOT NULL,
    "lastLoginIp" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "statusId" INTEGER NOT NULL,
    "scoreLabel" TEXT,
    "minuteLabel" TEXT,
    "homeTeamName" TEXT,
    "homeTeamShort" TEXT,
    "homeScore" TEXT,
    "awayTeamName" TEXT,
    "awayTeamShort" TEXT,
    "awayScore" TEXT,
    "symbol" TEXT,
    "changePercent24h" DECIMAL(8,4),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "marketType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSelection" (
    "id" SERIAL NOT NULL,
    "marketId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentPrice" DECIMAL(8,4) NOT NULL,
    "priceVersion" INTEGER NOT NULL DEFAULT 1,
    "statusId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "stake" DECIMAL(14,2) NOT NULL,
    "combinedOdds" DECIMAL(8,4) NOT NULL,
    "potentialReturn" DECIMAL(14,2) NOT NULL,
    "statusId" INTEGER NOT NULL,
    "legCount" INTEGER NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetSelectionLeg" (
    "id" SERIAL NOT NULL,
    "betId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "marketId" INTEGER NOT NULL,
    "marketName" TEXT NOT NULL,
    "selectionId" INTEGER NOT NULL,
    "selectionName" TEXT NOT NULL,
    "oddsAtPlacement" DECIMAL(8,4) NOT NULL,

    CONSTRAINT "BetSelectionLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "availableBalance" DECIMAL(14,2) NOT NULL,
    "lockedBalance" DECIMAL(14,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "statusId" INTEGER NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceTypeId" INTEGER,
    "referenceId" TEXT,
    "statusId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedger" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "transactionTypeId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "beforeAvailable" DECIMAL(14,2) NOT NULL,
    "afterAvailable" DECIMAL(14,2) NOT NULL,
    "beforeLocked" DECIMAL(14,2) NOT NULL,
    "afterLocked" DECIMAL(14,2) NOT NULL,
    "referenceTypeId" INTEGER,
    "referenceId" TEXT,
    "statusId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletRequest" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "statusId" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "WalletRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LookupType_code_key" ON "LookupType"("code");

-- CreateIndex
CREATE INDEX "Lookup_lookupTypeId_idx" ON "Lookup"("lookupTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Lookup_lookupTypeId_code_key" ON "Lookup"("lookupTypeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Event_externalId_key" ON "Event"("externalId");

-- CreateIndex
CREATE INDEX "Event_categoryId_idx" ON "Event"("categoryId");

-- CreateIndex
CREATE INDEX "Event_statusId_idx" ON "Event"("statusId");

-- CreateIndex
CREATE INDEX "Market_eventId_idx" ON "Market"("eventId");

-- CreateIndex
CREATE INDEX "Market_statusId_idx" ON "Market"("statusId");

-- CreateIndex
CREATE INDEX "MarketSelection_marketId_idx" ON "MarketSelection"("marketId");

-- CreateIndex
CREATE INDEX "MarketSelection_statusId_idx" ON "MarketSelection"("statusId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_statusId_idx" ON "Bet"("statusId");

-- CreateIndex
CREATE INDEX "BetSelectionLeg_betId_idx" ON "BetSelectionLeg"("betId");

-- CreateIndex
CREATE INDEX "BetSelectionLeg_marketId_idx" ON "BetSelectionLeg"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_statusId_idx" ON "Wallet"("statusId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_typeId_idx" ON "WalletTransaction"("typeId");

-- CreateIndex
CREATE INDEX "WalletTransaction_statusId_idx" ON "WalletTransaction"("statusId");

-- CreateIndex
CREATE INDEX "WalletLedger_walletId_idx" ON "WalletLedger"("walletId");

-- CreateIndex
CREATE INDEX "WalletLedger_transactionTypeId_idx" ON "WalletLedger"("transactionTypeId");

-- CreateIndex
CREATE INDEX "WalletRequest_walletId_idx" ON "WalletRequest"("walletId");

-- CreateIndex
CREATE INDEX "WalletRequest_userId_idx" ON "WalletRequest"("userId");

-- CreateIndex
CREATE INDEX "WalletRequest_statusId_idx" ON "WalletRequest"("statusId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_typeId_idx" ON "Notification"("typeId");

-- CreateIndex
CREATE INDEX "PriceHistory_symbol_timestamp_idx" ON "PriceHistory"("symbol", "timestamp");

-- AddForeignKey
ALTER TABLE "Lookup" ADD CONSTRAINT "Lookup_lookupTypeId_fkey" FOREIGN KEY ("lookupTypeId") REFERENCES "LookupType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSelection" ADD CONSTRAINT "MarketSelection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSelection" ADD CONSTRAINT "MarketSelection_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetSelectionLeg" ADD CONSTRAINT "BetSelectionLeg_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetSelectionLeg" ADD CONSTRAINT "BetSelectionLeg_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_referenceTypeId_fkey" FOREIGN KEY ("referenceTypeId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_referenceTypeId_fkey" FOREIGN KEY ("referenceTypeId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRequest" ADD CONSTRAINT "WalletRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRequest" ADD CONSTRAINT "WalletRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletRequest" ADD CONSTRAINT "WalletRequest_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Lookup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
