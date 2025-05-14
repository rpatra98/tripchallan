import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import Link from "next/link";
import PermissionsEditorWrapper from "@/app/components/PermissionsEditorWrapper";

export default async function EmployeeDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
  const session = await getServerSession(authOptions);
  const source = typeof searchParams.source === 'string' ? searchParams.source : null;
  const companyIdFromQuery = typeof searchParams.companyId === 'string' ? searchParams.companyId : null;
  
  // Add detailed logging to diagnose access issues
  console.log(`EmployeeDetailPage loaded for ID: ${params.id}`, {
    params,
    searchParams,
    source,
    companyIdFromQuery,
    hasSession: !!session,
    userIdFromSession: session?.user?.id
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link 
          href={
            source === "company" && companyIdFromQuery 
              ? `/dashboard/companies/${companyIdFromQuery}/employees` 
              : isCompany 
                ? "/dashboard?tab=employees" 
                : "/dashboard/employees"
          }
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          &larr; {
            source === "company" && companyIdFromQuery 
              ? "Back to Company Employees" 
              : isCompany 
                ? "Back to Dashboard" 
                : "Back to Employees"
          }
        </Link>
        <h1 className="text-2xl font-bold">{employee.name}</h1>
        <p className="text-gray-600">{employee.email}</p>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Employee Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">ID</p>
            <p>{employee.id}</p>
          </div>
          <div>
            <p className="text-gray-600">Company</p>
            <p>{employee.company?.name || "None"}</p>
          </div>
          <div>
            <p className="text-gray-600">Role</p>
            <p>{employee.subrole ? String(employee.subrole).toLowerCase().replace("_", " ") : "Employee"}</p>
          </div>
          <div>
            <p className="text-gray-600">Coins</p>
            <p>{employee.coins}</p>
          </div>
          <div>
            <p className="text-gray-600">Created</p>
            <p>{new Date(employee.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {employee.subrole === EmployeeSubrole.OPERATOR && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Operator Permissions</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center">
              <div className={`w-4 h-4 mr-2 rounded-full ${employee.operatorPermissions?.canCreate ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Create Trips/Sessions: {employee.operatorPermissions?.canCreate ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 mr-2 rounded-full ${employee.operatorPermissions?.canModify ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Modify Trips/Sessions: {employee.operatorPermissions?.canModify ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center">
              <div className={`w-4 h-4 mr-2 rounded-full ${employee.operatorPermissions?.canDelete ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>Delete Trips/Sessions: {employee.operatorPermissions?.canDelete ? 'Enabled' : 'Disabled'}</span>
            </div>
            {isAdmin && (
              <PermissionsEditorWrapper 
                employeeId={employee.id}
                initialPermissions={{
                  canCreate: employee.operatorPermissions?.canCreate || false,
                  canModify: employee.operatorPermissions?.canModify || false,
                  canDelete: employee.operatorPermissions?.canDelete || false
                }}
              />
            )}
            {!isAdmin && (
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 mt-3">
                <p className="text-sm text-yellow-700">
                  Note: Operator permissions can only be modified by system administrators.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No transactions found for this employee.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">With</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction: any) => {
                  const isSender = transaction.fromUserId === employee.id;
                  const otherParty = isSender ? transaction.toUser : transaction.fromUser;
                  
                  return (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {isSender ? "Sent" : "Received"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {otherParty.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={isSender ? "text-red-500" : "text-green-500"}>
                          {isSender ? "-" : "+"}{transaction.amount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.reason || transaction.reasonText || "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        {isAdmin && (
          <div className="flex gap-4">
            <Link
              href={`/dashboard/employees/edit/${employee.id}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Edit Employee
            </Link>
            <Link
              href={`/api/coins/transfer?toUserId=${employee.id}`}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Transfer Coins
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 