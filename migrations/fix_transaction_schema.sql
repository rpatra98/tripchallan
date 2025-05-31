-- Recreate the coin_transactions table with both camelCase and snake_case columns

-- First, check if the table exists
DO $$ 
BEGIN
  -- Drop existing table if it exists
  DROP TABLE IF EXISTS coin_transactions CASCADE;
  
  -- Create a new table with both naming conventions
  CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount INTEGER NOT NULL,
    -- Snake case columns
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Camel case columns
    "fromUserId" UUID,
    "toUserId" UUID,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Create indexes for better performance
  CREATE INDEX idx_coin_transactions_from_user ON coin_transactions(from_user_id);
  CREATE INDEX idx_coin_transactions_to_user ON coin_transactions(to_user_id);
  CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);
  CREATE INDEX idx_coin_transactions_from_user_camel ON coin_transactions("fromUserId");
  CREATE INDEX idx_coin_transactions_to_user_camel ON coin_transactions("toUserId");
  CREATE INDEX idx_coin_transactions_created_at_camel ON coin_transactions("createdAt");
  
  -- Create trigger functions to keep the columns in sync
  -- Function to sync from camelCase to snake_case
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
  
  -- Function to sync from snake_case to camelCase
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
  
  -- Create triggers for each direction
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
END $$;

-- Add some sample transactions
DO $$
DECLARE
  superadmin_id UUID;
  admin_id UUID;
BEGIN
  -- Get superadmin ID
  SELECT id INTO superadmin_id FROM users WHERE role = 'SUPERADMIN' LIMIT 1;
  
  -- Get one admin ID
  SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' LIMIT 1;
  
  -- Only create sample transactions if we have both users
  IF superadmin_id IS NOT NULL AND admin_id IS NOT NULL THEN
    -- Insert initial allocation transaction
    INSERT INTO coin_transactions (
      amount, from_user_id, to_user_id, notes, created_at, updated_at,
      "fromUserId", "toUserId", "createdAt", "updatedAt"
    ) VALUES (
      50000, superadmin_id, admin_id, 'Initial coin allocation', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
      superadmin_id, admin_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
    );
    
    -- Insert bonus transaction
    INSERT INTO coin_transactions (
      amount, from_user_id, to_user_id, notes, created_at, updated_at,
      "fromUserId", "toUserId", "createdAt", "updatedAt"
    ) VALUES (
      5000, superadmin_id, admin_id, 'Bonus coins', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
      superadmin_id, admin_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
    );
    
    -- Insert reclaim transaction
    INSERT INTO coin_transactions (
      amount, from_user_id, to_user_id, notes, created_at, updated_at,
      "fromUserId", "toUserId", "createdAt", "updatedAt"
    ) VALUES (
      1000, admin_id, superadmin_id, 'Reclaimed coins', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
      admin_id, superadmin_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
    );
  END IF;
END $$; 