-- Script to fix foreign key relationships between tables

-- First, check if the coin_transactions table has correct references to users
DO $$ 
BEGIN
  -- Drop existing foreign key constraints if they exist with wrong names
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'coin_transactions' AND 
    (column_name = 'from_user_id' OR column_name = 'to_user_id')
  ) THEN
    -- Drop the constraints (they'll be recreated with correct names)
    ALTER TABLE IF EXISTS coin_transactions 
    DROP CONSTRAINT IF EXISTS coin_transactions_from_user_id_fkey,
    DROP CONSTRAINT IF EXISTS coin_transactions_to_user_id_fkey,
    DROP CONSTRAINT IF EXISTS coin_transactions_fromUserId_fkey,
    DROP CONSTRAINT IF EXISTS coin_transactions_toUserId_fkey;
  END IF;
END $$;

-- Recreate the foreign key constraints with the correct names
ALTER TABLE coin_transactions 
ADD CONSTRAINT coin_transactions_from_user_id_fkey 
FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE coin_transactions 
ADD CONSTRAINT coin_transactions_to_user_id_fkey 
FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Also ensure activity_logs table has correct relationship to users
DO $$ 
BEGIN
  -- Drop existing foreign key constraints if they exist with wrong names
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'activity_logs' AND column_name = 'user_id'
  ) THEN
    -- Drop the constraints (they'll be recreated with correct names)
    ALTER TABLE IF EXISTS activity_logs 
    DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey,
    DROP CONSTRAINT IF EXISTS activity_logs_userId_fkey;
  END IF;
END $$;

-- Recreate the foreign key constraint with the correct name
ALTER TABLE activity_logs 
ADD CONSTRAINT activity_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Verify the constraints were added successfully
DO $$ 
BEGIN
  RAISE NOTICE 'Foreign key constraints have been fixed.';
END $$; 