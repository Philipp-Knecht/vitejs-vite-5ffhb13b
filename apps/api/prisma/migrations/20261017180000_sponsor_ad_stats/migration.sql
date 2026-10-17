-- CreateTable
CREATE TABLE "SponsorAdStat" (
    "campaign" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SponsorAdStat_pkey" PRIMARY KEY ("campaign","day")
);
