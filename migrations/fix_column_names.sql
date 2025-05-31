-- Migration to add both camelCase and snake_case column names to coin_transactions

-- First check if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coin_transactions') THEN
    -- Add camelCase columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'fromUserId') THEN
      ALTER TABLE coin_transactions ADD COLUMN "fromUserId" UUID;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'toUserId') THEN
      ALTER TABLE coin_transactions ADD COLUMN "toUserId" UUID;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'createdAt') THEN
      ALTER TABLE coin_transactions ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'updatedAt') THEN
      ALTER TABLE coin_transactions ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add snake_case columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'from_user_id') THEN
      ALTER TABLE coin_transactions ADD COLUMN from_user_id UUID;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'to_user_id') THEN
      ALTER TABLE coin_transactions ADD COLUMN to_user_id UUID;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'created_at') THEN
      ALTER TABLE coin_transactions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'updated_at') THEN
      ALTER TABLE coin_transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add triggers to sync camelCase and snake_case fields
    -- When inserting/updating camelCase fields, copy to snake_case
    CREATE OR REPLACE FUNCTION sync_camel_to_snake()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.from_user_id = NEW."fromUserId";
      NEW.to_user_id = NEW."toUserId";
      NEW.created_at = NEW."createdAt";
      NEW.updated_at = NEW."updatedAt";
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- When inserting/updating snake_case fields, copy to camelCase
    CREATE OR REPLACE FUNCTION sync_snake_to_camel()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."fromUserId" = NEW.from_user_id;
      NEW."toUserId" = NEW.to_user_id;
      NEW."createdAt" = NEW.created_at;
      NEW."updatedAt" = NEW.updated_at;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Drop the triggers if they already exist
    DROP TRIGGER IF EXISTS sync_camel_to_snake_trigger ON coin_transactions;
    DROP TRIGGER IF EXISTS sync_snake_to_camel_trigger ON coin_transactions;

    -- Create the triggers
    CREATE TRIGGER sync_camel_to_snake_trigger
    BEFORE INSERT OR UPDATE ON coin_transactions
    FOR EACH ROW
    WHEN (NEW."fromUserId" IS NOT NULL OR NEW."toUserId" IS NOT NULL OR NEW."createdAt" IS NOT NULL OR NEW."updatedAt" IS NOT NULL)
    EXECUTE FUNCTION sync_camel_to_snake();

    CREATE TRIGGER sync_snake_to_camel_trigger
    BEFORE INSERT OR UPDATE ON coin_transactions
    FOR EACH ROW
    WHEN (NEW.from_user_id IS NOT NULL OR NEW.to_user_id IS NOT NULL OR NEW.created_at IS NOT NULL OR NEW.updated_at IS NOT NULL)
    EXECUTE FUNCTION sync_snake_to_camel();

    -- Sync existing data
    UPDATE coin_transactions SET 
      "fromUserId" = from_user_id,
      "toUserId" = to_user_id,
      "createdAt" = created_at,
      "updatedAt" = updated_at
    WHERE from_user_id IS NOT NULL OR to_user_id IS NOT NULL;

    UPDATE coin_transactions SET 
      from_user_id = "fromUserId",
      to_user_id = "toUserId",
      created_at = "createdAt",
      updated_at = "updatedAt"
    WHERE "fromUserId" IS NOT NULL OR "toUserId" IS NOT NULL;
  END IF;
END $$; 