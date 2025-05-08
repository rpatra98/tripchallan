-- CreateTable
CREATE TABLE "admin_company_permissions" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_company_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_company_permissions_adminId_companyId_key" ON "admin_company_permissions"("adminId", "companyId");

-- AddForeignKey
ALTER TABLE "admin_company_permissions" ADD CONSTRAINT "admin_company_permissions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_company_permissions" ADD CONSTRAINT "admin_company_permissions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
