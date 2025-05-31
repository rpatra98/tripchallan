const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Check if environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runCoinTransactionFix() {
  try {
    console.log('Fixing coin_transactions table in Supabase...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'fix_coin_transactions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL with Supabase
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try alternative method if RPC fails
      console.log('Trying alternative method...');
      const { error: pgError } = await supabase.auth.admin.executeSql(sql);
      
      if (pgError) {
        console.error('Alternative method failed:', pgError);
        return;
      }
      
      console.log('Fix applied successfully using alternative method');
      return;
    }
    
    console.log('Fix applied successfully');
    
    // Verify the changes
    console.log('\nVerifying table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('coin_transactions')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('Error checking table structure:', columnsError);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('Column names in the table:');
      console.log(Object.keys(columns[0]));
    } else {
      console.log('Table is empty');
    }
    
    // Insert a test transaction to verify everything is working
    console.log('\nInserting test transaction...');
    
    // First, get the SuperAdmin user
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', 'superadmin@cbums.com')
      .limit(1);
    
    if (usersError) {
      console.error('Error fetching SuperAdmin:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('SuperAdmin user not found');
      return;
    }
    
    const superAdminId = users[0].id;
    
    // Insert a transaction using snake_case columns
    const { data: transaction, error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: superAdminId,
        to_user_id: superAdminId,
        amount: 100,
        notes: 'Test transaction after schema fix'
      })
      .select();
    
    if (transactionError) {
      console.error('Error inserting test transaction:', transactionError);
      return;
    }
    
    console.log('Test transaction inserted successfully:', transaction);
    
    // Verify that both snake_case and camelCase columns are present
    const { data: verifyData, error: verifyError } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('id', transaction[0].id)
      .limit(1);
    
    if (verifyError) {
      console.error('Error verifying transaction:', verifyError);
      return;
    }
    
    console.log('\nVerifying transaction data:');
    console.log(verifyData[0]);
    
    console.log('\nFix completed successfully!');
  } catch (error) {
    console.error('Error running coin transaction fix:', error);
  }
}

// Run the script
runCoinTransactionFix(); 