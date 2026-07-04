-- AlterTable
ALTER TABLE "Cita" ADD COLUMN "allowOverlap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "overlapReason" TEXT,
ADD COLUMN "overlapConfirmedById" TEXT,
ADD COLUMN "overlapConfirmedAt" TIMESTAMP(3);
