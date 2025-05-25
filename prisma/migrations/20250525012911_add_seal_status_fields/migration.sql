-- AlterTable
ALTER TABLE "seals" ADD COLUMN     "status" TEXT,
ADD COLUMN     "statusComment" TEXT,
ADD COLUMN     "statusEvidence" JSONB,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);
