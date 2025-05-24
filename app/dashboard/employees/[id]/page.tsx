import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import EmployeeDetailClient from "./client";

export default async function EmployeeDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
  const session = await getServerSession(authOptions);
  const source = typeof searchParams.source === 'string' ? searchParams.source : null;
  const companyIdFromQuery = typeof searchParams.companyId === 'string' ? searchParams.companyId : null;
  
  // Add detailed logging to diagnose access issues
  console.log(`[DEBUG] EmployeeDetailPage loaded for ID: ${params.id}`, {
    params,
    searchParams,
    source,
    companyIdFromQuery,
    hasSession: !!session,
    userIdFromSession: session?.user?.id,
    url: typeof window !== 'undefined' ? window.location.href : 'server-side rendering'
  });
  
  if (!session) {
    console.log("No session found, redirecting to login");
    redirect("/");
  }

  // Get user with detailed information
  const dbUser = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true, 
      role: true,
      name: true,
      email: true,
      _count: {
        select: {
          employees: true  // Count employees for this company
        }
      }
    }
  });

  if (!dbUser) {
    redirect("/");
  }

  // Check authorization - only ADMIN, SUPERADMIN and the employee's own COMPANY can view
  const isAdmin = dbUser.role === UserRole.ADMIN || dbUser.role === UserRole.SUPERADMIN;
  const isCompany = dbUser.role === UserRole.COMPANY;

  // Get employee details with expanded company information
  const employee = await prisma.user.findUnique({
    where: {
      id: params.id,
      role: UserRole.EMPLOYEE,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      operatorPermissions: true
    }
  });

  if (!employee) {
    notFound();
  }

    // If user is a COMPANY, verify this employee belongs to them by fetching directly
    let hasAccess = isAdmin; // Admins always have access
    
    if (isCompany) {
      // If we have a companyId from the query params, use that for permission checking
      const companyIdToCheck = companyIdFromQuery || dbUser.id;
      
      console.log(`Checking if company ${companyIdToCheck} owns employee ${params.id}`, {
        employeeCompanyId: employee.companyId,
        dbUserId: dbUser.id,
        companyIdFromQuery,
        matchCheck: employee.companyId === companyIdToCheck
      });
      
      // First check if the company in the query is the authenticated company
      const isAuthorizedCompany = !companyIdFromQuery || companyIdFromQuery === dbUser.id;
      
      if (!isAuthorizedCompany) {
        console.log("Unauthorized access attempt: Query companyId doesn't match authenticated company");
        redirect("/dashboard");
      }
      
      // Try multiple approaches to check access
      // 1. Direct companyId match
      const directMatch = employee.companyId === companyIdToCheck;
      
      // 2. Check if employee is in company's employees list
      const companyRecord = await prisma.company.findFirst({
        where: {
          OR: [
            { id: companyIdToCheck },
            {
              employees: {
                some: {
                  id: companyIdToCheck
                }
              }
            }
          ]
        },
        include: {
          employees: {
            where: {
              id: params.id
            },
            select: {
              id: true
            }
          }
        }
      });
      
      const relationMatch = companyRecord?.employees?.some((e: { id: string }) => e.id === params.id) || false;
      
      // 3. Created by this company
      const createdByMatch = employee.createdById === companyIdToCheck;
      
      // Grant access if any of the checks pass
      hasAccess = directMatch || relationMatch || createdByMatch;
      
      console.log("Company access check result:", {
        companyId: companyIdToCheck,
        companyName: dbUser.name,
        employeeId: params.id,
        employeeCompanyId: employee.companyId,
        source,
        directMatch,
        relationMatch,
        createdByMatch,
        hasAccess
      });
    }
  
  // Now do the access check
  if (!hasAccess) {
    console.log("Access denied: User does not have permission to view this employee");
    redirect("/dashboard");
  }

  // Get transaction history for this employee
  const transactions = await prisma.coinTransaction.findMany({
    where: {
      OR: [
        { fromUserId: employee.id },
        { toUserId: employee.id }
      ]
    },
    include: {
      fromUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      },
      toUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 10, // Limit to most recent 10 transactions
  });

  // Render the client component with all the data
  return (
    <EmployeeDetailClient
      employee={employee}
      transactions={transactions}
      isAdmin={isAdmin}
      isCompany={isCompany}
      source={source}
      companyIdFromQuery={companyIdFromQuery}
    />
  );
} 