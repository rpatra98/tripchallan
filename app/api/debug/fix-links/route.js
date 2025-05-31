import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * This endpoint scans for and attempts to fix broken company links in sessions and elsewhere.
 * It helps recover from situations where the application has links to companies that don't exist.
 */
export async function GET() {
  try {
    // Find all valid companies
    const { data: companies, error: companiesError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'COMPANY');

    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({
        message: "No companies found in the database",
        suggestion: "Create a company first by visiting /api/debug/setup"
      });
    }

    // Find all sessions that reference non-existent companies
    const { data: sessionsWithMissingCompanies, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, companyId')
      .not('companyId', 'in', `(${companies.map(c => c.id).join(',')})`);

    if (sessionsError) {
      console.error('Error fetching sessions with missing companies:', sessionsError);
    }

    // Find all employees with missing company references
    const { data: employeesWithMissingCompanies, error: employeesError } = await supabase
      .from('users')
      .select('id, name, companyId')
      .eq('role', 'EMPLOYEE')
      .not('companyId', 'in', `(${companies.map(c => c.id).join(',')})`)
      .not('companyId', 'is', null);

    if (employeesError) {
      console.error('Error fetching employees with missing companies:', employeesError);
    }

    // Use the first valid company as fallback
    const fallbackCompany = companies[0];
    const updates = [];

    // Fix sessions with broken company references
    if (sessionsWithMissingCompanies && sessionsWithMissingCompanies.length > 0) {
      const sessionIds = sessionsWithMissingCompanies.map(s => s.id);
      const { data: updateSessions, error: updateSessionsError } = await supabase
        .from('sessions')
        .update({ companyId: fallbackCompany.id })
        .in('id', sessionIds);
      
      if (updateSessionsError) {
        console.error('Error updating sessions:', updateSessionsError);
      } else {
        updates.push({
          type: "sessions",
          count: sessionIds.length,
          newCompanyId: fallbackCompany.id
        });
      }
    }

    // Fix employees with broken company references
    if (employeesWithMissingCompanies && employeesWithMissingCompanies.length > 0) {
      const employeeIds = employeesWithMissingCompanies.map(e => e.id);
      const { data: updateEmployees, error: updateEmployeesError } = await supabase
        .from('users')
        .update({ companyId: fallbackCompany.id })
        .in('id', employeeIds);
      
      if (updateEmployeesError) {
        console.error('Error updating employees:', updateEmployeesError);
      } else {
        updates.push({
          type: "employees",
          count: employeeIds.length,
          newCompanyId: fallbackCompany.id
        });
      }
    }

    return NextResponse.json({
      message: "Link check and repair complete",
      companies,
      fixes: {
        sessionsFixed: sessionsWithMissingCompanies ? sessionsWithMissingCompanies.length : 0,
        employeesFixed: employeesWithMissingCompanies ? employeesWithMissingCompanies.length : 0,
        updates
      },
      suggestion: "Visit /dashboard/companies/list-all to see valid companies",
      fallbackCompany
    });
  } catch (error) {
    console.error("Error in link fixing:", error);
    return NextResponse.json(
      {
        error: "Failed to fix links",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 