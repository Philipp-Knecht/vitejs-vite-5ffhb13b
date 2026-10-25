-- CreateTable
CREATE TABLE "ChatUsage" (
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChatUsage_pkey" PRIMARY KEY ("subjectType","subjectId","day")
);
