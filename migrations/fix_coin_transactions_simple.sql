-- Simple fix for coin_transactions table to add missing columns
-- Run this in the Supabase SQL Editor

-- Add camelCase columns if they don't exist
DO $$ 
BEGIN
  -- Add fromUserId column if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'fromUserId') THEN
    ALTER TABLE coin_transactions ADD COLUMN "fromUserId" UUID;
  END IF;

  -- Add toUserId column if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'toUserId') THEN
    ALTER TABLE coin_transactions ADD COLUMN "toUserId" UUID;
  END IF;

  -- Add createdAt column if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'createdAt') THEN
    ALTER TABLE coin_transactions ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add updatedAt column if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'updatedAt') THEN
    ALTER TABLE coin_transactions ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add reason and reasonText fields if they don't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'reason') THEN
    ALTER TABLE coin_transactions ADD COLUMN reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'reasonText') THEN
    ALTER TABLE coin_transactions ADD COLUMN "reasonText" TEXT;
  END IF;
  
  -- Create trigger function to keep columns in sync
  CREATE OR REPLACE FUNCTION sync_transaction_columns()
  RETURNS TRIGGER AS $$
  BEGIN
    -- Sync from snake_case to camelCase
    IF (TG_OP = 'INSERT' OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id) THEN
      NEW."fromUserId" = NEW.from_user_id;
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id) THEN
      NEW."toUserId" = NEW.to_user_id;
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
      NEW."createdAt" = NEW.created_at;
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW.updated_at IS DISTINCT FROM OLD.updated_at) THEN
      NEW."updatedAt" = NEW.updated_at;
    END IF;
    
    -- Sync from camelCase to snake_case
    IF (TG_OP = 'INSERT' OR NEW."fromUserId" IS DISTINCT FROM OLD."fromUserId") THEN
      NEW.from_user_id = NEW."fromUserId";
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW."toUserId" IS DISTINCT FROM OLD."toUserId") THEN
      NEW.to_user_id = NEW."toUserId";
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt") THEN
      NEW.created_at = NEW."createdAt";
    END IF;
    
    IF (TG_OP = 'INSERT' OR NEW."updatedAt" IS DISTINCT FROM OLD."updatedAt") THEN
      NEW.updated_at = NEW."updatedAt";
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Drop trigger if it exists and recreate it
  DROP TRIGGER IF EXISTS sync_transaction_columns_trigger ON coin_transactions;
  
  CREATE TRIGGER sync_transaction_columns_trigger
  BEFORE INSERT OR UPDATE ON coin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_transaction_columns();
  
  -- Update existing rows to sync camelCase columns with snake_case values
  UPDATE coin_transactions 
  SET 
    "fromUserId" = from_user_id,
    "toUserId" = to_user_id,
    "createdAt" = created_at,
    "updatedAt" = updated_at;
    
  -- Create indexes for camelCase columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_coin_transactions_fromUserId') THEN
    CREATE INDEX idx_coin_transactions_fromUserId ON coin_transactions("fromUserId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_coin_transactions_toUserId') THEN
    CREATE INDEX idx_coin_transactions_toUserId ON coin_transactions("toUserId");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_coin_transactions_createdAt') THEN
    CREATE INDEX idx_coin_transactions_createdAt ON coin_transactions("createdAt");
  END IF;
END $$; 