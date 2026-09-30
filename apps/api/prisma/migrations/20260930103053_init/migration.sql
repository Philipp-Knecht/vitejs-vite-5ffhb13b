-- CreateEnum
CREATE TYPE "AccountPlan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "ListingSourceType" AS ENUM ('KLEINANZEIGEN_URL', 'TEXT', 'EXAMPLE');

-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('VEHICLE', 'ELECTRONICS', 'COMPUTER', 'SMARTPHONE', 'CAMERA', 'BIKE', 'TOOL', 'FURNITURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "plan" "AccountPlan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "sourceType" "ListingSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "status" TEXT,
    "title" TEXT,
    "priceEur" INTEGER,
    "priceKind" TEXT,
    "priceRaw" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "district" TEXT,
    "locationRaw" TEXT,
    "sellerType" TEXT,
    "sellerMemberSince" TEXT,
    "postedAt" TEXT,
    "description" TEXT,
    "images" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "isExample" BOOLEAN NOT NULL DEFAULT false,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "variant" TEXT,
    "mileageKm" INTEGER,
    "firstRegistrationYear" INTEGER,
    "firstRegistrationMonth" INTEGER,
    "fuel" TEXT,
    "powerKw" INTEGER,
    "powerPs" INTEGER,
    "transmission" TEXT,
    "drivetrain" TEXT,
    "huYear" INTEGER,
    "huMonth" INTEGER,
    "previousOwners" INTEGER,
    "serviceHistory" TEXT,
    "accidentHistory" TEXT,
    "condition" TEXT,
    "bodyType" TEXT,
    "color" TEXT,
    "doors" TEXT,
    "emissionClass" TEXT,
    "equipment" TEXT[],
    "fieldSources" JSONB NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "userId" UUID,
    "anonymousId" TEXT,
    "rulesVersion" TEXT NOT NULL,
    "aiStatus" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "completenessScore" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerQuestion" (
    "id" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textInformal" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "relatedField" TEXT,
    "origin" TEXT NOT NULL,

    CONSTRAINT "SellerQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "analysisId" UUID NOT NULL,
    "customTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "analysesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "plan" "AccountPlan" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Listing_fingerprint_retrievedAt_idx" ON "Listing"("fingerprint", "retrievedAt");

-- CreateIndex
CREATE INDEX "Listing_sourceType_externalId_idx" ON "Listing"("sourceType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_listingId_key" ON "Vehicle"("listingId");

-- CreateIndex
CREATE INDEX "Vehicle_make_model_firstRegistrationYear_idx" ON "Vehicle"("make", "model", "firstRegistrationYear");

-- CreateIndex
CREATE INDEX "Analysis_userId_createdAt_idx" ON "Analysis"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Analysis_anonymousId_createdAt_idx" ON "Analysis"("anonymousId", "createdAt");

-- CreateIndex
CREATE INDEX "Analysis_listingId_idx" ON "Analysis"("listingId");

-- CreateIndex
CREATE INDEX "SellerQuestion_analysisId_position_idx" ON "SellerQuestion"("analysisId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SellerQuestion_analysisId_key_key" ON "SellerQuestion"("analysisId", "key");

-- CreateIndex
CREATE INDEX "SavedListing_userId_createdAt_idx" ON "SavedListing"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListing_userId_fingerprint_key" ON "SavedListing"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_subjectType_subjectId_period_key" ON "Usage"("subjectType", "subjectId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerCustomerId_key" ON "Subscription"("providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerQuestion" ADD CONSTRAINT "SellerQuestion_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
