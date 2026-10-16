-- AlterTable
ALTER TABLE "User" ADD COLUMN     "remindersConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReminderConfirmToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderConfirmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarReminder" (
    "id" UUID NOT NULL,
    "carId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "emailOnAt" TIMESTAMP(3),
    "year" INTEGER,
    "month" INTEGER,
    "lastSentKey" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderConfirmToken_tokenHash_key" ON "ReminderConfirmToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ReminderConfirmToken_userId_idx" ON "ReminderConfirmToken"("userId");

-- CreateIndex
CREATE INDEX "CarReminder_email_idx" ON "CarReminder"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CarReminder_carId_kind_key" ON "CarReminder"("carId", "kind");

-- AddForeignKey
ALTER TABLE "ReminderConfirmToken" ADD CONSTRAINT "ReminderConfirmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarReminder" ADD CONSTRAINT "CarReminder_carId_fkey" FOREIGN KEY ("carId") REFERENCES "OwnedCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

