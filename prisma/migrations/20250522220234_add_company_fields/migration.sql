-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "companyType" TEXT DEFAULT '--Others--',
ADD COLUMN     "documents" TEXT[],
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "logo" TEXT;
