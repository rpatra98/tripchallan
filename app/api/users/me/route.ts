import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { ensureSuperAdmin } from "@/lib/ensure-superadmin";

// Remove the withAuth wrapper to diagnose session issues
export async function GET(req: NextRequest) {
  try {
    console.log('GET /api/users/me: Starting request');
    
    // Set cache control headers to prevent caching
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    };
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log('GET /api/users/me: No session found');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers }
      );
    }

    console.log(`GET /api/users/me: Session found for user ${session.user.id}, role: ${session.user.role}`);

    // Special handling for SuperAdmin
    if (session.user.role === 'SUPERADMIN') {
      console.log('GET /api/users/me: Ensuring SuperAdmin user exists with correct coins');
      const superAdmin = await ensureSuperAdmin();
      
      if (superAdmin) {
        console.log(`GET /api/users/me: Returning SuperAdmin data with ${superAdmin.coins} coins`);
        return NextResponse.json(superAdmin, { headers });
      }
    }

    // Fetch user data from Supabase
    console.log(`GET /api/users/me: Fetching user data for ${session.user.id}`);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, coins')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error("Error fetching user data:", error);
      
      // Try once more with a different approach
      console.log('GET /api/users/me: Retrying with direct SQL query');
      try {
        const { data: userData, error: sqlError } = await supabase.rpc('exec_sql', {
          sql: `SELECT id, name, email, role, coins FROM users WHERE id = '${session.user.id}' LIMIT 1`
        });
        
        if (sqlError || !userData || !Array.isArray(userData) || userData.length === 0) {
          console.error("Error with SQL fallback:", sqlError);
          return NextResponse.json(
            { error: "Failed to fetch user data" },
            { status: 500, headers }
          );
        }
        
        // Return the first row from the SQL query result
        console.log(`GET /api/users/me: SQL query successful, returning user with ${userData[0].coins} coins`);
        return NextResponse.json(userData[0], { headers });
      } catch (sqlErr) {
        console.error("Error in SQL fallback:", sqlErr);
        return NextResponse.json(
          { error: "Failed to fetch user data" },
          { status: 500, headers }
        );
      }
    }
    
    // If user not found but we have session data
    if (!user && session.user.id) {
      console.error(`GET /api/users/me: User with ID ${session.user.id} not found in database`);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers }
      );
    }
    
    // Verify coins is not null
    if (user && user.coins === null) {
      console.log(`GET /api/users/me: User ${user.id} has null coins, setting to 0`);
      
      // Update user with 0 coins
      const { error: updateError } = await supabase
        .from('users')
        .update({ coins: 0 })
        .eq('id', user.id);
      
      if (updateError) {
        console.error("Error updating null coins:", updateError);
      } else {
        user.coins = 0;
      }
    }
    
    console.log(`GET /api/users/me: Successfully returning user data with ${user.coins} coins`);
    return NextResponse.json(user, { headers });
  } catch (error) {
    console.error("Error in /api/users/me:", error);
    return NextResponse.json(
      { error: "Failed to get user data" },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
  }
} 