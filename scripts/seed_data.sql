-- Create initial users
DO $$
DECLARE
  superadmin_id UUID;
  admin_id UUID;
BEGIN
  -- Check if superadmin exists
  SELECT id INTO superadmin_id FROM users WHERE email = 'superadmin@cbums.com' AND role = 'SUPERADMIN';
  
  -- Create superadmin if not exists
  IF superadmin_id IS NULL THEN
    INSERT INTO users (
      name, email, password, role, coins, 
      "createdAt", "updatedAt", created_at, updated_at
    ) VALUES (
      'Super Admin', 
      'superadmin@cbums.com', 
      -- Password: superadmin123 (hashed)
      '$2b$12$WfpUktPuA8F32pgxjf6G9u3m.KYxatPBaJVtLD53Efq.O/cr1Go7G', 
      'SUPERADMIN', 
      1000000,
      NOW(), NOW(), NOW(), NOW()
    )
    RETURNING id INTO superadmin_id;
    
    RAISE NOTICE 'Created SuperAdmin with ID: %', superadmin_id;
  ELSE
    RAISE NOTICE 'SuperAdmin already exists with ID: %', superadmin_id;
  END IF;
  
  -- Create test admin if no admins exist
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'ADMIN') THEN
    INSERT INTO users (
      name, email, password, role, coins, 
      "createdAt", "updatedAt", created_at, updated_at
    ) VALUES (
      'Test Admin', 
      'admin@example.com', 
      -- Password: admin123 (hashed)
      '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 
      'ADMIN', 
      1000,
      NOW(), NOW(), NOW(), NOW()
    )
    RETURNING id INTO admin_id;
    
    RAISE NOTICE 'Created Admin with ID: %', admin_id;
    
    -- Create initial coin transaction for admin creation
    INSERT INTO coin_transactions (
      amount, from_user_id, to_user_id, notes, created_at, updated_at,
      "fromUserId", "toUserId", "createdAt", "updatedAt"
    ) VALUES (
      1000, superadmin_id, admin_id, 'Initial coin allocation for new admin', NOW(), NOW(),
      superadmin_id, admin_id, NOW(), NOW()
    );
    
    RAISE NOTICE 'Created initial transaction between SuperAdmin and Admin';
  ELSE
    RAISE NOTICE 'At least one Admin already exists';
  END IF;
END $$;

-- Create more sample transactions if they don't exist
DO $$
DECLARE
  superadmin_id UUID;
  admin_ids UUID[];
  admin_id UUID;
  i INTEGER;
BEGIN
  -- Get superadmin ID
  SELECT id INTO superadmin_id FROM users WHERE role = 'SUPERADMIN' LIMIT 1;
  
  -- Get admin IDs
  SELECT array_agg(id) INTO admin_ids FROM users WHERE role = 'ADMIN' LIMIT 3;
  
  -- Check if we already have transactions
  IF (SELECT COUNT(*) FROM coin_transactions) < 3 THEN
    -- Loop through each admin and create transactions
    FOR i IN 1..array_length(admin_ids, 1) LOOP
      admin_id := admin_ids[i];
      
      -- Create bonus transaction
      INSERT INTO coin_transactions (
        amount, from_user_id, to_user_id, notes, created_at, updated_at,
        "fromUserId", "toUserId", "createdAt", "updatedAt"
      ) VALUES (
        500, superadmin_id, admin_id, 'Bonus coins for performance', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
        superadmin_id, admin_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
      );
      
      -- Create reclaim transaction
      INSERT INTO coin_transactions (
        amount, from_user_id, to_user_id, notes, created_at, updated_at,
        "fromUserId", "toUserId", "createdAt", "updatedAt"
      ) VALUES (
        200, admin_id, superadmin_id, 'Reclaimed coins for unused allocation', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
        admin_id, superadmin_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
      );
    END LOOP;
    
    RAISE NOTICE 'Created sample transactions for % admins', array_length(admin_ids, 1);
  ELSE
    RAISE NOTICE 'Transactions already exist, skipping creation';
  END IF;
END $$; 