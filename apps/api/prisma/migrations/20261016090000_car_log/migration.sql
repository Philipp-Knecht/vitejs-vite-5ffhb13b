-- CreateTable
CREATE TABLE "CarLogEntry" (
    "id" UUID NOT NULL,
    "carId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "odometerKm" INTEGER,
    "amountCents" INTEGER,
    "quantityHundredths" INTEGER,
    "fullTank" BOOLEAN NOT NULL DEFAULT false,
    "workshop" TEXT,
    "note" TEXT,
    "invoice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarLogEntry_carId_date_idx" ON "CarLogEntry"("carId", "date");

-- AddForeignKey
ALTER TABLE "CarLogEntry" ADD CONSTRAINT "CarLogEntry_carId_fkey" FOREIGN KEY ("carId") REFERENCES "OwnedCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
