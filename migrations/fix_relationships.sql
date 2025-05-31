-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS coin_transactions
DROP CONSTRAINT IF EXISTS coin_transactions_fromUserId_fkey,
DROP CONSTRAINT IF EXISTS coin_transactions_toUserId_fkey,
DROP CONSTRAINT IF EXISTS coin_transactions_from_user_id_fkey,
DROP CONSTRAINT IF EXISTS coin_transactions_to_user_id_fkey;

-- Rename columns if they are using camelCase instead of snake_case
DO $$ 
BEGIN
  -- Check if fromUserId column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'fromUserId'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE coin_transactions RENAME COLUMN "fromUserId" TO from_user_id;
  END IF;

  -- Check if toUserId column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'toUserId'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE coin_transactions RENAME COLUMN "toUserId" TO to_user_id;
  END IF;

  -- Check if createdAt column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'createdAt'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE coin_transactions RENAME COLUMN "createdAt" TO created_at;
  END IF;

  -- Check if updatedAt column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'coin_transactions' AND column_name = 'updatedAt'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE coin_transactions RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;

-- Same for activity_logs table
DO $$ 
BEGIN
  -- Check if userId column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'userId'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "userId" TO user_id;
  END IF;

  -- Check if targetResourceId column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'targetResourceId'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "targetResourceId" TO target_resource_id;
  END IF;

  -- Check if targetResourceType column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'targetResourceType'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "targetResourceType" TO target_resource_type;
  END IF;

  -- Check if ipAddress column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'ipAddress'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "ipAddress" TO ip_address;
  END IF;

  -- Check if userAgent column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'userAgent'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "userAgent" TO user_agent;
  END IF;

  -- Check if createdAt column exists
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'activity_logs' AND column_name = 'createdAt'
  ) THEN
    -- Rename the column to snake_case
    ALTER TABLE activity_logs RENAME COLUMN "createdAt" TO created_at;
  END IF;
END $$;

-- Now add back the correct foreign key constraints
ALTER TABLE coin_transactions
ADD CONSTRAINT coin_transactions_from_user_id_fkey
FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE coin_transactions
ADD CONSTRAINT coin_transactions_to_user_id_fkey
FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add foreign key constraint for activity_logs
ALTER TABLE activity_logs
ADD CONSTRAINT activity_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; 