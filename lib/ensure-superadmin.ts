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
      } else {
        console.log('SuperAdmin created successfully');
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
      } else {
        console.log('SuperAdmin created successfully');
        // Record the initial allocation as a transaction
        await recordCoinAdjustment(newAdmin.id, 1000000);
      }
      
      return;
    }
    
    // Update SuperAdmin coins if needed
    if (superAdmin.coins < 1000000) {
      console.log(`Updating SuperAdmin coins from ${superAdmin.coins} to 1,000,000`);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          coins: 1000000,
          updated_at: new Date().toISOString()
        })
        .eq('id', superAdmin.id);
      
      if (updateError) {
        console.error('Error updating SuperAdmin coins:', updateError);
      } else {
        console.log('SuperAdmin coins updated successfully');
        // Record the adjustment as a transaction
        await recordCoinAdjustment(superAdmin.id, 1000000 - superAdmin.coins);
      }
    } else {
      console.log(`SuperAdmin already has sufficient coins: ${superAdmin.coins}`);
    }
  } catch (error) {
    console.error('Error ensuring SuperAdmin exists:', error);
  }
}

// Record a coin adjustment transaction
async function recordCoinAdjustment(userId: string, amount: number) {
  try {
    // Create a self-transaction for system adjustments
    const { error } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: userId, // System adjustment
        to_user_id: userId,
        amount: Math.abs(amount),
        reason: 'SYSTEM',
        notes: 'System balance adjustment during initialization',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error recording coin adjustment transaction:', error);
    } else {
      console.log(`Recorded coin adjustment transaction of ${amount} coins for user ${userId}`);
    }
  } catch (error) {
    console.error('Error recording coin adjustment:', error);
  }
} 