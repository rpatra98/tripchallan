# Database Migrations

This directory contains SQL migration files that are applied to the Supabase database.

## How to use

1. Create a new migration file with a timestamp prefix, e.g., `20250601_add_new_field.sql`
2. Add your SQL statements to the file
3. Run `npm run migrate` to apply your migration

## How migrations work

The migration system will:

1. Check which migrations have already been applied by consulting the `migrations` table
2. Apply only new migrations in alphabetical order
3. Record applied migrations in the `migrations` table

## Creating a new migration

```sql
-- Example migration file: 20250601_add_new_field.sql

-- Add a new column to a table
ALTER TABLE "users" ADD COLUMN "last_login" TIMESTAMP WITH TIME ZONE;

-- Create an index
CREATE INDEX "idx_users_last_login" ON "users" ("last_login");
```

## Important notes

- Always test your migrations locally before deploying
- Make sure migrations are idempotent (can be run multiple times without issues)
- Use `IF NOT EXISTS` and `IF EXISTS` clauses when possible
- Be careful with destructive operations (DROP, DELETE) 