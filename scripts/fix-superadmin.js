#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  
  // If only service role key is missing, continue with a warning
  if (missingEnvVars.length === 1 && missingEnvVars[0] === 'SUPABASE_SERVICE_ROLE_KEY') {
    console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Some operations may fail due to permission issues.');
  } else {
    process.exit(1);
  }
}

// Create Supabase client with anon key (for reading)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Create Supabase admin client with service role key (for privileged operations)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? 
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) : null;

// Function to fix SuperAdmin coin balance
async function fixSuperAdmin() {
  try {
    console.log('Fixing SuperAdmin coin balance...');
    
    // Find SuperAdmin user
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      
      // Try a direct SQL query as a fallback
      try {
        console.log('Trying direct SQL query to find SuperAdmin...');
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: `SELECT * FROM users WHERE email = 'superadmin@cbums.com' AND role = 'SUPERADMIN' LIMIT 1`
        });
        
        if (error || !data || !Array.isArray(data) || data.length === 0) {
          console.error('Error with SQL query:', error);
          return;
        }
        
        console.log(`Found SuperAdmin via SQL: ${data[0].id}`);
        return fixSuperAdminCoins(data[0]);
      } catch (sqlErr) {
        console.error('Error with SQL fallback:', sqlErr);
        return;
      }
    }
    
    if (!superAdmin) {
      console.error('SuperAdmin not found in database');
      return;
    }
    
    await fixSuperAdminCoins(superAdmin);
  } catch (error) {
    console.error('Error fixing SuperAdmin:', error);
  }
}

// Function to fix SuperAdmin coins
async function fixSuperAdminCoins(superAdmin) {
  console.log(`Found SuperAdmin user with ID: ${superAdmin.id}`);
  console.log(`Current coins: ${superAdmin.coins}`);
  
  // Skip if coins are already correct
  if (superAdmin.coins === 1000000) {
    console.log('SuperAdmin coins already at 1,000,000. No adjustment needed.');
    return;
  }
  
  // Try to update via different methods
  const methods = [
    { name: 'Update via standard Supabase client', fn: updateViaStandard },
    { name: 'Update via admin client', fn: updateViaAdmin },
    { name: 'Update via SQL function', fn: updateViaSQL },
    { name: 'Update via API call', fn: updateViaAPI }
  ];
  
  let success = false;
  
  for (const method of methods) {
    if (success) break;
    
    console.log(`Trying method: ${method.name}`);
    try {
      success = await method.fn(superAdmin);
      if (success) {
        console.log(`SuperAdmin coins updated successfully via ${method.name}`);
      }
    } catch (error) {
      console.error(`Error with method ${method.name}:`, error);
    }
  }
  
  if (!success) {
    console.error('All update methods failed. Unable to fix SuperAdmin coins.');
    return;
  }
  
  // Record the transaction
  await recordTransaction(superAdmin);
}

// Update using standard Supabase client
async function updateViaStandard(superAdmin) {
  const { error } = await supabase
    .from('users')
    .update({ 
      coins: 1000000,
      updated_at: new Date().toISOString()
    })
    .eq('id', superAdmin.id);
  
  if (error) {
    console.error('Error updating via standard client:', error);
    return false;
  }
  
  return true;
}

// Update using admin client with service role
async function updateViaAdmin(superAdmin) {
  if (!supabaseAdmin) {
    console.warn('Admin client not available (no service role key)');
    return false;
  }
  
  const { error } = await supabaseAdmin
    .from('users')
    .update({ 
      coins: 1000000,
      updated_at: new Date().toISOString()
    })
    .eq('id', superAdmin.id);
  
  if (error) {
    console.error('Error updating via admin client:', error);
    return false;
  }
  
  return true;
}

// Update using SQL function
async function updateViaSQL(superAdmin) {
  const client = supabaseAdmin || supabase;
  const { error } = await client.rpc('exec_sql', {
    sql: `UPDATE users SET coins = 1000000, updated_at = NOW() WHERE id = '${superAdmin.id}'`
  });
  
  if (error) {
    console.error('Error updating via SQL:', error);
    return false;
  }
  
  return true;
}

// Update using REST API
async function updateViaAPI(superAdmin) {
  try {
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${superAdmin.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'apikey': apiKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ 
        coins: 1000000,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      console.error('Error updating via API:', await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception updating via API:', error);
    return false;
  }
}

// Record transaction
async function recordTransaction(superAdmin) {
  const adjustment = 1000000 - (superAdmin.coins || 0);
  
  if (adjustment === 0) {
    console.log('No adjustment needed, coins already at 1,000,000');
    return;
  }
  
  console.log(`Recording transaction for adjustment of ${Math.abs(adjustment)} coins`);
  
  const now = new Date().toISOString();
  const client = supabaseAdmin || supabase;
  
  const { error } = await client
    .from('coin_transactions')
    .insert({
      from_user_id: superAdmin.id,
      to_user_id: superAdmin.id,
      amount: Math.abs(adjustment),
      reason: 'SYSTEM',
      notes: 'System balance adjustment via fix-superadmin script',
      created_at: now,
      updated_at: now
    });
  
  if (error) {
    console.error('Error recording transaction:', error);
    
    // Try using SQL as fallback
    try {
      console.log('Trying SQL to record transaction...');
      const { error: sqlError } = await client.rpc('exec_sql', {
        sql: `
          INSERT INTO coin_transactions 
          (from_user_id, to_user_id, amount, reason, notes, created_at, updated_at)
          VALUES (
            '${superAdmin.id}', 
            '${superAdmin.id}', 
            ${Math.abs(adjustment)}, 
            'SYSTEM', 
            'System balance adjustment via fix-superadmin script', 
            '${now}', 
            '${now}'
          )
        `
      });
      
      if (sqlError) {
        console.error('Error recording transaction via SQL:', sqlError);
      } else {
        console.log('Transaction recorded successfully via SQL');
      }
    } catch (sqlErr) {
      console.error('Exception recording transaction via SQL:', sqlErr);
    }
  } else {
    console.log('Transaction recorded successfully');
  }
  
  // Verify final state
  try {
    const { data, error: verifyError } = await supabase
      .from('users')
      .select('coins')
      .eq('id', superAdmin.id)
      .single();
    
    if (verifyError) {
      console.error('Error verifying final state:', verifyError);
    } else {
      console.log(`Final verification: SuperAdmin now has ${data.coins} coins`);
    }
  } catch (verifyErr) {
    console.error('Exception during verification:', verifyErr);
  }
}

// Run the function
fixSuperAdmin(); 