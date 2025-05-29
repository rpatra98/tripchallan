import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import EmployeeDetailClient from "./client";
import Link from "next/link";
import prismaHelper from "@/lib/prisma-helper";

// Add dynamic exports to ensure Next.js treats this as a dynamic route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function EmployeeDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
  // Get query parameters
  const source = typeof searchParams.source === 'string' ? searchParams.source : null;
  const companyIdFromQuery = typeof searchParams.companyId === 'string' ? searchParams.companyId : null;
  
  try {
    // Reset connection before doing anything
    await prismaHelper.resetConnection();
    
    const session = await getServerSession(authOptions);
    
    // Add detailed logging to diagnose access issues
    console.log(`[DEBUG] EmployeeDetailPage loaded for ID: ${params.id}`, {
      params,
      searchParams,
      source,
      companyIdFromQuery,
      hasSession: !!session,
      userIdFromSession: session?.user?.id,
    });
    
    if (!session) {
      console.log("No session found, redirecting to login");
      redirect("/");
    }

    // Get user with detailed information using prisma helper
    const dbUser = await prismaHelper.executePrismaWithRetry(async () => {
      return prisma.user.findUnique({
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
    });

    if (!dbUser) {
      redirect("/");
    }

    // Check authorization - only ADMIN, SUPERADMIN and the employee's own COMPANY can view
    const isAdmin = dbUser.role === UserRole.ADMIN || dbUser.role === UserRole.SUPERADMIN;
    const isCompany = dbUser.role === UserRole.COMPANY;

    // Reset connection before complex query
    await prismaHelper.resetConnection();
    
    // Get employee details with expanded company information
    const employee = await prismaHelper.executePrismaWithRetry(async () => {
      return prisma.user.findUnique({
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
    });

    if (!employee) {
      notFound();
    }

    // If user is a COMPANY, verify this employee belongs to them by fetching directly
    let hasAccess = isAdmin; // Admins always have access
    
    if (isCompany) {
      // Reset connection before another complex query
      await prismaHelper.resetConnection();
      
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
      const companyRecord = await prismaHelper.executePrismaWithRetry(async () => {
        return prisma.company.findFirst({
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

    // Reset connection before getting transactions
    await prismaHelper.resetConnection();
    
    // Get transaction history for this employee
    const transactions = await prismaHelper.executePrismaWithRetry(async () => {
      return prisma.coinTransaction.findMany({
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
    
  } catch (error) {
    console.error("Error in employee details page:", error);
    
    // Check if this is a prepared statement error and try to handle it
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isPreparedStatementError = 
      errorMessage.includes('prepared statement') || 
      errorMessage.includes('42P05');
    
    if (isPreparedStatementError) {
      try {
        // Try to reset the connection with a longer delay
        await prismaHelper.resetConnection(3000);
      } catch (resetError) {
        console.error("Failed to reset connection:", resetError);
      }
    }
    
    return (
      <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Error</h1>
        <p className="mt-2">An error occurred while trying to fetch employee details.</p>
        <p className="mt-2 text-red-500">{errorMessage}</p>
        <div className="mt-4 flex space-x-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            &larr; Go back to Dashboard
          </Link>
          <Link href="/dashboard/employees" className="text-blue-600 hover:underline">
            View All Employees
          </Link>
          <Link 
            href={`/dashboard/employees/${params.id}`}
            className="text-blue-600 hover:underline"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }
} 