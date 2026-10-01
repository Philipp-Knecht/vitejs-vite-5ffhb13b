-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONCLUDED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ContractNoticeType" AS ENUM ('CANCELLATION', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "vatMode" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "consentTexts" JSONB NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "immediateStartRequestedAt" TIMESTAMP(3) NOT NULL,
    "checkoutSessionId" TEXT,
    "subscriptionId" TEXT,
    "concludedAt" TIMESTAMP(3),
    "receiptSentAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractNotice" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ContractNoticeType" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "orderNumber" TEXT,
    "kind" TEXT,
    "reason" TEXT,
    "requestedEndDate" DATE,
    "userId" UUID,
    "subscriptionId" TEXT,
    "outcome" TEXT NOT NULL,
    "effectiveEnd" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "operatorNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "ContractNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutSessionId_key" ON "Order"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_subscriptionId_idx" ON "Order"("subscriptionId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractNotice_number_key" ON "ContractNotice"("number");

-- CreateIndex
CREATE INDEX "ContractNotice_type_outcome_idx" ON "ContractNotice"("type", "outcome");

-- CreateIndex
CREATE INDEX "ContractNotice_userId_idx" ON "ContractNotice"("userId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractNotice" ADD CONSTRAINT "ContractNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
