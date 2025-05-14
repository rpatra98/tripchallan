-- Create operator_permissions table
CREATE TABLE "operator_permissions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  "canCreate" BOOLEAN NOT NULL DEFAULT true,
  "canModify" BOOLEAN NOT NULL DEFAULT false,
  "canDelete" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operator_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operator_permissions_userId_key" UNIQUE ("userId"),
  CONSTRAINT "operator_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index on userId for faster lookups
CREATE INDEX "operator_permissions_userId_idx" ON "operator_permissions"("userId"); 