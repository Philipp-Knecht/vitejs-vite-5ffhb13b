-- CreateTable
CREATE TABLE "OwnedCar" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nickname" TEXT,
    "makeId" TEXT NOT NULL,
    "modelId" TEXT,
    "modelName" TEXT NOT NULL,
    "generationId" TEXT,
    "fuel" TEXT,
    "firstRegistrationYear" INTEGER NOT NULL,
    "firstRegistrationMonth" INTEGER,
    "mileageKm" INTEGER,
    "huYear" INTEGER,
    "huMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnedCar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnedCar_userId_createdAt_idx" ON "OwnedCar"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "OwnedCar" ADD CONSTRAINT "OwnedCar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
