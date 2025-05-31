import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { UserRole, EmployeeSubrole } from "@/lib/enums";
import Link from "next/link";
import PermissionsEditorWrapper from "@/app/components/PermissionsEditorWrapper";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  // Get user with detailed information
  const dbUser = await supabase.from('users').select('*').eq('id', session.user.id).single();

  if (!dbUser) {
    redirect("/");
  }

  // Check authorization - only ADMIN, SUPERADMIN and the employee's own COMPANY can view
  const isAdmin = dbUser.role === UserRole.ADMIN || dbUser.role === UserRole.SUPERADMIN;

  // Get employee details
  const employee = await supabase.from('users').findUnique({
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

  // If not admin, check if user is this employee's company
  if (!isAdmin && employee.companyId !== dbUser.id) {
    redirect("/dashboard");
  }

  // Get transaction history for this employee
  const transactions = await supabase.from('coinTransactions').select('*').{
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
          href={isAdmin ? "/dashboard" : "/dashboard/company"}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          &larr; Back to Dashboard
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
              href={`/dashboard/employees/${employee.id}/edit`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Edit Employee
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 