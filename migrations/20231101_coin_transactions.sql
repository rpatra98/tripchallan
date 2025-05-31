-- Create coin_transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount INTEGER NOT NULL,
  fromUserId UUID REFERENCES users(id),
  toUserId UUID REFERENCES users(id),
  notes TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coin_transactions_from_user ON coin_transactions(fromUserId);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_to_user ON coin_transactions(toUserId);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(createdAt);

-- Add foreign key constraints if not already present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coin_transactions_fromUserId_fkey'
  ) THEN
    ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_fromUserId_fkey
    FOREIGN KEY (fromUserId) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coin_transactions_toUserId_fkey'
  ) THEN
    ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_toUserId_fkey
    FOREIGN KEY (toUserId) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  details JSONB,
  target_resource_id UUID,
  target_resource_type VARCHAR(255),
  ip_address VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action); 