import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

export const GET = withAuth(
  async (req: NextRequest, context: { params: Record<string, string> } | undefined) => {
    try {
      if (!context || !context.params) {
        return NextResponse.json(
          { error: "Invalid route parameters" },
          { status: 400 }
        );
      }
      
      const { params } = context;
      const adminId = params.id;
      const session = await getServerSession(authOptions);
      
      // Only SuperAdmin can view admin details
      if (session?.user.role !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Only SuperAdmin can view admin details" },
          { status: 403 }
        );
      }
      
      // Verify admin exists
      const admin = await supabase.from('users').findFirst({
        where: {
          id: adminId,
          role: UserRole.ADMIN
        }
      });
      
      if (!admin) {
        return NextResponse.json(
          { error: "Admin not found" },
          { status: 404 }
        );
      }
      
      // Get companies where admin has created employees
      const { data: employeeUsers, error: employeeError } = await supabase
        .from('users')
        .select('companyId')
        .eq('role', UserRole.EMPLOYEE)
        .eq('createdById', adminId);
      
      if (employeeError) {
        console.error('Error fetching employee companies:', employeeError);
        return NextResponse.json({ error: 'Failed to fetch employee companies' }, { status: 500 });
      }
      
      // Get unique company IDs
      const companyIds = [...new Set(employeeUsers?.map(user => user.companyId).filter(Boolean) || [])];
      
      if (companyIds.length === 0) {
        return NextResponse.json([]);
      }
      
      // Get company details
      const { data: companies, error: companiesError } = await supabase
        .from('users')
        .select('*')
        .in('id', companyIds)
        .eq('role', UserRole.COMPANY);
      
      if (companiesError) {
        console.error('Error fetching company details:', companiesError);
        return NextResponse.json({ error: 'Failed to fetch company details' }, { status: 500 });
      }
      
      return NextResponse.json(companies || []);
    } catch (error) {
      console.error('Error in employee companies route:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  [UserRole.SUPERADMIN]
); 