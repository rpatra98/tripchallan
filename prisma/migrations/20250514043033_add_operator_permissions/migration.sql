/*
  Warnings:

  - You are about to drop the `admin_company_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "admin_company_permissions" DROP CONSTRAINT "admin_company_permissions_adminId_fkey";

-- DropForeignKey
ALTER TABLE "admin_company_permissions" DROP CONSTRAINT "admin_company_permissions_companyId_fkey";

-- DropTable
DROP TABLE "admin_company_permissions";

-- CreateTable
CREATE TABLE "operator_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canCreate" BOOLEAN NOT NULL DEFAULT true,
    "canModify" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operator_permissions_userId_key" ON "operator_permissions"("userId");

-- AddForeignKey
ALTER TABLE "operator_permissions" ADD CONSTRAINT "operator_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
