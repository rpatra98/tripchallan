import { supabase } from "./supabase";
import bcrypt from "bcrypt";

export async function ensureSuperAdmin() {
  try {
    console.log('Checking SuperAdmin user...');
    
    // Look for SuperAdmin
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding SuperAdmin:', findError);
      console.log('Attempting to create SuperAdmin since there was an error finding one...');
      
      // Let's create a new SuperAdmin if there was an error finding one
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          name: 'Super Admin',
          email: 'superadmin@cbums.com',
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating SuperAdmin:', createError);
        console.log('Will try to check if SuperAdmin already exists despite the error...');
        
        // Double-check if SuperAdmin exists despite the error
        const { data: checkAdmin } = await supabase
          .from('users')
          .select('id, name, email, role, coins')
          .eq('email', 'superadmin@cbums.com')
          .single();
        
        if (checkAdmin) {
          console.log('SuperAdmin found in second check:', checkAdmin.id);
          
          // Update coins if needed
          if (checkAdmin.coins < 1000000) {
            console.log(`Updating SuperAdmin coins from ${checkAdmin.coins || 0} to 1,000,000`);
            
            const { error: updateError } = await supabase
              .from('users')
              .update({ 
                coins: 1000000,
                updated_at: new Date().toISOString()
              })
              .eq('id', checkAdmin.id);
            
            if (updateError) {
              console.error('Error updating SuperAdmin coins:', updateError);
            } else {
              console.log('SuperAdmin coins updated successfully on second check');
              // Record the adjustment
              await recordCoinAdjustment(checkAdmin.id, 1000000 - (checkAdmin.coins || 0));
            }
          }
        }
      } else {
        console.log('SuperAdmin created successfully:', newAdmin.id);
        // Record the initial allocation as a transaction
        await recordCoinAdjustment(newAdmin.id, 1000000);
      }
      
      return;
    }
    
    if (!superAdmin) {
      console.log('SuperAdmin not found, creating one...');
      
      // Create a new SuperAdmin
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          name: 'Super Admin',
          email: 'superadmin@cbums.com',
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating SuperAdmin:', createError);
        
        // Try a different approach - update if it exists but wasn't found for some reason
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', 'superadmin@cbums.com');
        
        if (existingUser && existingUser.length > 0) {
          console.log('Found existing user with SuperAdmin email, updating...');
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              name: 'Super Admin',
              role: 'SUPERADMIN',
              coins: 1000000,
              updated_at: new Date().toISOString()
            })
            .eq('email', 'superadmin@cbums.com');
          
          if (updateError) {
            console.error('Error updating existing user to SuperAdmin:', updateError);
          } else {
            console.log('Successfully updated existing user to SuperAdmin');
            // Record the initial allocation as a transaction
            await recordCoinAdjustment(existingUser[0].id, 1000000);
          }
        }
      } else {
        console.log('SuperAdmin created successfully');
        // Record the initial allocation as a transaction
        await recordCoinAdjustment(newAdmin.id, 1000000);
      }
      
      return;
    }
    
    // Update SuperAdmin coins if needed
    console.log(`Current SuperAdmin coins: ${superAdmin.coins || 0}`);
    
    if (!superAdmin.coins || superAdmin.coins < 1000000) {
      console.log(`Updating SuperAdmin coins from ${superAdmin.coins || 0} to 1,000,000`);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          coins: 1000000,
          updated_at: new Date().toISOString()
        })
        .eq('id', superAdmin.id);
      
      if (updateError) {
        console.error('Error updating SuperAdmin coins:', updateError);
        
        // Try a direct SQL update as a fallback
        try {
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            sql: `UPDATE users SET coins = 1000000, updated_at = NOW() WHERE id = '${superAdmin.id}'`
          });
          
          if (sqlError) {
            console.error('Error with direct SQL update of SuperAdmin coins:', sqlError);
          } else {
            console.log('SuperAdmin coins updated successfully via direct SQL');
            // Record the adjustment
            await recordCoinAdjustment(superAdmin.id, 1000000 - (superAdmin.coins || 0));
          }
        } catch (e) {
          console.error('Exception during direct SQL update:', e);
        }
      } else {
        console.log('SuperAdmin coins updated successfully');
        // Record the adjustment as a transaction
        await recordCoinAdjustment(superAdmin.id, 1000000 - (superAdmin.coins || 0));
      }
      
      // Verify the update worked
      const { data: verifyAdmin } = await supabase
        .from('users')
        .select('coins')
        .eq('id', superAdmin.id)
        .single();
      
      if (verifyAdmin) {
        console.log(`Verified SuperAdmin now has ${verifyAdmin.coins} coins`);
      }
    } else {
      console.log(`SuperAdmin already has sufficient coins: ${superAdmin.coins}`);
    }
    
    // Return the SuperAdmin for use by the caller
    return superAdmin;
  } catch (error) {
    console.error('Error ensuring SuperAdmin exists:', error);
    
    // Try one final direct check
    try {
      const { data } = await supabase
        .from('users')
        .select('id, coins')
        .eq('email', 'superadmin@cbums.com')
        .single();
      
      if (data) {
        console.log('Final check found SuperAdmin with coins:', data.coins);
        return data;
      }
    } catch (e) {
      console.error('Final SuperAdmin check failed:', e);
    }
  }
}

// Record a coin adjustment transaction
async function recordCoinAdjustment(userId: string, amount: number) {
  try {
    if (!userId) {
      console.error('Cannot record coin adjustment: userId is missing');
      return;
    }
    
    const now = new Date().toISOString();
    
    // Create a self-transaction for system adjustments
    const { data, error } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: userId, // System adjustment
        to_user_id: userId,
        amount: Math.abs(amount),
        reason: 'SYSTEM',
        notes: 'System balance adjustment during initialization',
        created_at: now,
        updated_at: now
      })
      .select();
    
    if (error) {
      console.error('Error recording coin adjustment transaction:', error);
    } else {
      console.log(`Recorded coin adjustment transaction of ${amount} coins for user ${userId}`, data?.[0]?.id);
    }
  } catch (error) {
    console.error('Error recording coin adjustment:', error);
  }
} 