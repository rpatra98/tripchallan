"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import PermissionsEditorWrapper from "@/app/components/PermissionsEditorWrapper";
import { 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Alert
} from "@mui/material";

// Define the props interface
interface EmployeeDetailClientProps {
  employee: any;
  transactions: any[];
  isAdmin: boolean;
  isCompany: boolean;
  source: string | null;
  companyIdFromQuery: string | null;
}

export default function EmployeeDetailClient({ 
  employee, 
  transactions, 
  isAdmin, 
  isCompany, 
  source, 
  companyIdFromQuery 
}: EmployeeDetailClientProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };
  
  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setDeleteError(null);
    }
  };
  
  const confirmDeleteEmployee = async () => {
    setDeleteLoading(true);
    
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete employee');
      }
      
      // Success - redirect back to employees list
      alert('Employee deleted successfully');
      router.push('/dashboard/employees');
    } catch (error) {
      console.error('Error deleting employee:', error);
      setDeleteError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

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
              href={`/dashboard/employees/${employee.id}/edit`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Edit Employee
            </Link>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteClick}
            >
              Delete Employee
            </Button>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Employee Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete employee {employee.name}? This action cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteEmployee} 
            color="error" 
            disabled={deleteLoading}
            variant="contained"
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 