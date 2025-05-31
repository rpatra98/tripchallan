import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/lib/enums";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the requester is an admin or superadmin
    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // Get query parameters
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");

    // Build the query
    let query = supabase
      .from('users')
      .select(`
        id, 
        name, 
        email, 
        role, 
        subrole, 
        companyId, 
        createdAt, 
        coins,
        company:companies(id, name, email)
      `)
      .eq('role', UserRole.EMPLOYEE)
      .order('createdAt', { ascending: false });

    // Filter by company if specified
    if (companyId) {
      query = query.eq('companyId', companyId);
    }

    // Fetch all employees
    const { data: employees, error } = await query;

    if (error) {
      throw error;
    }

    console.log(`Found ${employees.length} employees`);
    
    return NextResponse.json(employees);
  } catch (error: unknown) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 