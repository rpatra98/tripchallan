-- Migration to fix the coin_transactions table in Supabase
-- This script checks if the table exists with the right columns and adds any missing ones

DO $$ 
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coin_transactions') THEN
    -- Add camelCase columns if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'fromUserId') THEN
      ALTER TABLE coin_transactions ADD COLUMN "fromUserId" UUID;
      
      -- Create trigger to sync from snake_case to camelCase
      CREATE OR REPLACE FUNCTION sync_from_snake_to_camel()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."fromUserId" = NEW.from_user_id;
        NEW."toUserId" = NEW.to_user_id;
        NEW."createdAt" = NEW.created_at;
        NEW."updatedAt" = NEW.updated_at;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER sync_snake_to_camel_trigger
      BEFORE INSERT OR UPDATE ON coin_transactions
      FOR EACH ROW
      EXECUTE FUNCTION sync_from_snake_to_camel();
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

    -- Add reason fields if they don't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'reason') THEN
      ALTER TABLE coin_transactions ADD COLUMN reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'reasonText') THEN
      ALTER TABLE coin_transactions ADD COLUMN "reasonText" TEXT;
    END IF;

    -- Update existing rows to sync camelCase columns with snake_case values
    UPDATE coin_transactions 
    SET 
      "fromUserId" = from_user_id,
      "toUserId" = to_user_id,
      "createdAt" = created_at,
      "updatedAt" = updated_at;
      
    -- Create indexes for camelCase columns
    CREATE INDEX IF NOT EXISTS idx_coin_transactions_fromUserId ON coin_transactions("fromUserId");
    CREATE INDEX IF NOT EXISTS idx_coin_transactions_toUserId ON coin_transactions("toUserId");
    CREATE INDEX IF NOT EXISTS idx_coin_transactions_createdAt ON coin_transactions("createdAt");
  ELSE
    -- Create the table with both naming conventions if it doesn't exist
    CREATE TABLE coin_transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      amount INTEGER NOT NULL,
      -- Snake case columns
      from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      -- Camel case columns
      "fromUserId" UUID,
      "toUserId" UUID,
      "reasonText" TEXT,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes for better performance
    CREATE INDEX idx_coin_transactions_from_user ON coin_transactions(from_user_id);
    CREATE INDEX idx_coin_transactions_to_user ON coin_transactions(to_user_id);
    CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);
    CREATE INDEX idx_coin_transactions_fromUserId ON coin_transactions("fromUserId");
    CREATE INDEX idx_coin_transactions_toUserId ON coin_transactions("toUserId");
    CREATE INDEX idx_coin_transactions_createdAt ON coin_transactions("createdAt");
    
    -- Create trigger to sync between camelCase and snake_case
    CREATE OR REPLACE FUNCTION sync_from_snake_to_camel()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."fromUserId" = NEW.from_user_id;
      NEW."toUserId" = NEW.to_user_id;
      NEW."createdAt" = NEW.created_at;
      NEW."updatedAt" = NEW.updated_at;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER sync_snake_to_camel_trigger
    BEFORE INSERT OR UPDATE ON coin_transactions
    FOR EACH ROW
    EXECUTE FUNCTION sync_from_snake_to_camel();
  END IF;
END $$; 