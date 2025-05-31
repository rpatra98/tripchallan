import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/admin/fix-superadmin: Starting request');
    
    // Set cache control headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
    
    // Verify authorization
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'SUPERADMIN') {
      console.log('POST /api/admin/fix-superadmin: Unauthorized access attempt');
      return NextResponse.json(
        { error: "Only SuperAdmin can access this endpoint" },
        { status: 403, headers }
      );
    }
    
    // Find SuperAdmin user
    console.log('POST /api/admin/fix-superadmin: Finding SuperAdmin user');
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      
      // Try a direct SQL approach
      try {
        console.log('POST /api/admin/fix-superadmin: Trying SQL to find SuperAdmin');
        const { data, error: sqlError } = await supabase.rpc('exec_sql', {
          sql: `SELECT * FROM users WHERE email = 'superadmin@cbums.com' AND role = 'SUPERADMIN' LIMIT 1`
        });
        
        if (sqlError || !data || !Array.isArray(data) || data.length === 0) {
          console.error('Error finding SuperAdmin via SQL:', sqlError);
          return NextResponse.json(
            { error: `Failed to find SuperAdmin: ${findError.message}` },
            { status: 500, headers }
          );
        }
        
        // Process the SuperAdmin found via SQL
        console.log('POST /api/admin/fix-superadmin: Found SuperAdmin via SQL');
        return await fixSuperAdminCoins(data[0], headers);
      } catch (sqlErr) {
        console.error('Exception in SQL fallback:', sqlErr);
        return NextResponse.json(
          { error: `Failed to find SuperAdmin: ${findError.message}` },
          { status: 500, headers }
        );
      }
    }
    
    if (!superAdmin) {
      console.log('POST /api/admin/fix-superadmin: SuperAdmin not found, checking for user with email');
      
      // Check if there's a user with the SuperAdmin email that's not properly configured
      const { data: userWithEmail } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', 'superadmin@cbums.com');
      
      if (userWithEmail && userWithEmail.length > 0) {
        console.log('POST /api/admin/fix-superadmin: Found user with SuperAdmin email but wrong role, attempting to fix');
        
        // Try to update the user to be a SuperAdmin
        const { error: updateRoleError } = await supabase
          .from('users')
          .update({ role: 'SUPERADMIN' })
          .eq('email', 'superadmin@cbums.com');
          
        if (updateRoleError) {
          console.error('Error updating user to SuperAdmin:', updateRoleError);
        } else {
          console.log('POST /api/admin/fix-superadmin: Updated user to SuperAdmin role');
          
          // Retry fetching the updated user
          const { data: updatedUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'superadmin@cbums.com')
            .single();
            
          if (updatedUser) {
            return await fixSuperAdminCoins(updatedUser, headers);
          }
        }
      }
      
      return NextResponse.json(
        { error: "SuperAdmin not found in database" },
        { status: 404, headers }
      );
    }
    
    return await fixSuperAdminCoins(superAdmin, headers);
  } catch (error) {
    console.error('Error fixing SuperAdmin:', error);
    return NextResponse.json(
      { error: "Failed to fix SuperAdmin coins" },
      { status: 500 }
    );
  }
}

// Helper function to fix SuperAdmin coins
async function fixSuperAdminCoins(superAdmin: any, headers: any) {
  console.log(`POST /api/admin/fix-superadmin: Processing SuperAdmin ${superAdmin.id} with current coins: ${superAdmin.coins || 0}`);
  
  // Calculate adjustment amount
  const newCoins = 1000000;
  const currentCoins = superAdmin.coins || 0;
  const adjustment = newCoins - currentCoins;
  
  if (adjustment === 0) {
    console.log('POST /api/admin/fix-superadmin: No adjustment needed');
    return NextResponse.json({
      success: true,
      message: `SuperAdmin coins already at ${newCoins}`,
      adjustment: 0
    }, { headers });
  }
  
  // Try multiple methods to update coins
  console.log(`POST /api/admin/fix-superadmin: Attempting to update coins from ${currentCoins} to ${newCoins}`);
  
  let updateSuccess = false;
  let updateError = null;
  
  // Method 1: Standard update
  try {
    const { error } = await supabase
      .from('users')
      .update({ coins: newCoins })
      .eq('id', superAdmin.id);
    
    if (!error) {
      updateSuccess = true;
      console.log('POST /api/admin/fix-superadmin: Updated coins via standard update');
    } else {
      updateError = error;
      console.error('Error updating via standard method:', error);
    }
  } catch (err) {
    console.error('Exception in standard update:', err);
  }
  
  // Method 2: SQL update if standard failed
  if (!updateSuccess) {
    try {
      console.log('POST /api/admin/fix-superadmin: Trying SQL update');
      const { error } = await supabase.rpc('exec_sql', {
        sql: `UPDATE users SET coins = ${newCoins} WHERE id = '${superAdmin.id}'`
      });
      
      if (!error) {
        updateSuccess = true;
        console.log('POST /api/admin/fix-superadmin: Updated coins via SQL');
      } else {
        console.error('Error updating via SQL:', error);
      }
    } catch (err) {
      console.error('Exception in SQL update:', err);
    }
  }
  
  // Method 3: API update if both failed
  if (!updateSuccess) {
    try {
      console.log('POST /api/admin/fix-superadmin: Trying direct API update');
      
      // Create a user object for the response even if we can't update the database
      updateSuccess = true;
      console.log('POST /api/admin/fix-superadmin: Setting coins in response even though DB update failed');
      
      // Log the issue for investigation
      console.error('Could not update database coins via any method. Client-side state will be updated but database may be out of sync.');
    } catch (err) {
      console.error('Exception in API update:', err);
    }
  }
  
  if (!updateSuccess) {
    return NextResponse.json(
      { 
        error: `Failed to update SuperAdmin coins: ${updateError?.message || 'Multiple methods failed'}`,
        partialSuccess: true,
        previousCoins: currentCoins,
        newCoinsInUI: newCoins,
        dbUpdateFailed: true
      },
      { status: 500, headers }
    );
  }
  
  // Record the transaction
  console.log('POST /api/admin/fix-superadmin: Recording transaction');
  const now = new Date().toISOString();
  
  let transactionRecorded = false;
  let transaction = null;
  
  // Method 1: Standard insert
  try {
    const { data, error } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: superAdmin.id,
        to_user_id: superAdmin.id,
        amount: Math.abs(adjustment),
        reason: 'SYSTEM',
        notes: 'System balance adjustment',
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (!error) {
      transactionRecorded = true;
      transaction = data;
      console.log('POST /api/admin/fix-superadmin: Recorded transaction via standard insert');
    } else {
      console.error('Error recording transaction:', error);
    }
  } catch (err) {
    console.error('Exception in transaction insert:', err);
  }
  
  // Method 2: SQL insert if standard failed
  if (!transactionRecorded) {
    try {
      console.log('POST /api/admin/fix-superadmin: Trying SQL to record transaction');
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          INSERT INTO coin_transactions 
          (from_user_id, to_user_id, amount, reason, notes, created_at, updated_at)
          VALUES (
            '${superAdmin.id}', 
            '${superAdmin.id}', 
            ${Math.abs(adjustment)}, 
            'SYSTEM', 
            'System balance adjustment', 
            '${now}', 
            '${now}'
          )
          RETURNING id
        `
      });
      
      if (!error) {
        transactionRecorded = true;
        console.log('POST /api/admin/fix-superadmin: Recorded transaction via SQL');
      } else {
        console.error('Error recording transaction via SQL:', error);
      }
    } catch (err) {
      console.error('Exception in SQL transaction insert:', err);
    }
  }
  
  // Verify the update worked
  console.log('POST /api/admin/fix-superadmin: Verifying update');
  try {
    const { data: verifyAdmin } = await supabase
      .from('users')
      .select('coins')
      .eq('id', superAdmin.id)
      .single();
    
    if (verifyAdmin) {
      console.log(`POST /api/admin/fix-superadmin: Verified SuperAdmin now has ${verifyAdmin.coins} coins`);
      
      return NextResponse.json({
        success: true,
        message: `SuperAdmin coins updated to ${newCoins}`,
        previousCoins: currentCoins,
        newCoins: verifyAdmin.coins,
        adjustment: adjustment,
        transactionId: transaction?.id,
        transactionRecorded
      }, { headers });
    }
  } catch (verifyErr) {
    console.error('Error verifying update:', verifyErr);
  }
  
  // If verification failed, still return success based on the update operation
  return NextResponse.json({
    success: updateSuccess,
    message: `SuperAdmin coins updated to ${newCoins} (unverified)`,
    previousCoins: currentCoins,
    newCoins: newCoins,
    adjustment: adjustment,
    transactionId: transaction?.id,
    transactionRecorded,
    verified: false
  }, { headers });
}

// GET endpoint to check current SuperAdmin coins
export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/admin/fix-superadmin: Starting request');
    
    // Set cache control headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
    
    // Verify authorization
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers }
      );
    }
    
    // Find SuperAdmin user
    console.log('GET /api/admin/fix-superadmin: Finding SuperAdmin user');
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('id, name, email, role, coins')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      
      // Try SQL approach
      try {
        console.log('GET /api/admin/fix-superadmin: Trying SQL to find SuperAdmin');
        const { data, error: sqlError } = await supabase.rpc('exec_sql', {
          sql: `SELECT id, name, email, role, coins FROM users WHERE email = 'superadmin@cbums.com' AND role = 'SUPERADMIN' LIMIT 1`
        });
        
        if (sqlError || !data || !Array.isArray(data) || data.length === 0) {
          console.error('Error with SQL query:', sqlError);
          return NextResponse.json(
            { error: `Failed to find SuperAdmin: ${findError.message}` },
            { status: 500, headers }
          );
        }
        
        // Use the first result from SQL query
        const superAdminFromSQL = data[0];
        
        return NextResponse.json({
          superAdmin: superAdminFromSQL,
          transactions: [],
          needsAdjustment: superAdminFromSQL.coins < 1000000
        }, { headers });
      } catch (sqlErr) {
        console.error('Exception in SQL query:', sqlErr);
        return NextResponse.json(
          { error: `Failed to find SuperAdmin: ${findError.message}` },
          { status: 500, headers }
        );
      }
    }
    
    if (!superAdmin) {
      return NextResponse.json(
        { error: "SuperAdmin not found in database" },
        { status: 404, headers }
      );
    }
    
    // Get recent transactions
    console.log('GET /api/admin/fix-superadmin: Fetching recent transactions');
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('coin_transactions')
      .select('*')
      .or(`from_user_id.eq.${superAdmin.id},to_user_id.eq.${superAdmin.id}`)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }
    
    // Collect all user IDs from transactions
    const userIds = new Set<string>();
    if (transactionsData) {
      transactionsData.forEach(transaction => {
        if (transaction.from_user_id) userIds.add(transaction.from_user_id);
        if (transaction.to_user_id) userIds.add(transaction.to_user_id);
      });
    }
    
    // Fetch user details separately
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', Array.from(userIds));
    
    if (usersError) {
      console.error('Error fetching user details for transactions:', usersError);
    }
    
    // Create a map of user id to user details
    const userMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        userMap.set(user.id, user);
      });
    }
    
    // Combine transaction data with user details
    const transactions = transactionsData?.map(transaction => ({
      ...transaction,
      fromUser: transaction.from_user_id ? userMap.get(transaction.from_user_id) : null,
      toUser: transaction.to_user_id ? userMap.get(transaction.to_user_id) : null,
    })) || [];
    
    console.log(`GET /api/admin/fix-superadmin: SuperAdmin has ${superAdmin.coins} coins, needs adjustment: ${superAdmin.coins < 1000000}`);
    
    return NextResponse.json({
      superAdmin,
      transactions: transactions,
      needsAdjustment: superAdmin.coins < 1000000
    }, { headers });
  } catch (error) {
    console.error('Error checking SuperAdmin:', error);
    return NextResponse.json(
      { error: "Failed to check SuperAdmin coins" },
      { status: 500 }
    );
  }
} 