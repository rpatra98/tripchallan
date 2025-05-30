-- Create coin_transactions table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount INTEGER NOT NULL,
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coin_transactions_from_user ON coin_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_to_user ON coin_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);

-- Add foreign key constraints if not already present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coin_transactions_from_user_id_fkey'
  ) THEN
    ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_from_user_id_fkey
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'coin_transactions_to_user_id_fkey'
  ) THEN
    ALTER TABLE coin_transactions
    ADD CONSTRAINT coin_transactions_to_user_id_fkey
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE SET NULL;
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