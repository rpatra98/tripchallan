"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import { UserRole } from "@/lib/enums";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import CompanyActions from "./company-actions";

// Force dynamic rendering to bypass caching issues
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default function CompanyDetailPage({ params }) {
  const companyId = params.id;
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });
  
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    
    const fetchCompanyDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/companies/${companyId}`);
        
        if (!res.ok) {
          if (res.status === 404) {
            notFound();
          } else {
            throw new Error("Failed to fetch company");
          }
        }
        
        const data = await res.json();
        setCompany(data);
        
        // Fetch employees for this company
        const empRes = await fetch(`/api/companies/${companyId}/employees`);
        if (empRes.ok) {
          const empData = await empRes.json();
          console.log("Raw employee data:", empData);
          
          // Filter out employees whose email matches the company's email
          // And only include GUARD and OPERATOR subroles (case insensitive)
          const filteredEmps = empData.filter(emp => {
            // Make sure it's not the company admin
            const isNotAdmin = emp.email.toLowerCase() !== data.email.toLowerCase() && 
                               emp.name.toLowerCase() !== data.name.toLowerCase();
            
            // Check if subrole exists and is either GUARD or OPERATOR (case insensitive)
            const subroleUpper = emp.subrole ? emp.subrole.toUpperCase() : '';
            const isAllowedRole = subroleUpper === "GUARD" || subroleUpper === "OPERATOR";
            
            return isNotAdmin && isAllowedRole;
          });
          
          console.log("Filtered employees:", filteredEmps);
          setEmployees(filteredEmps);
        }
      } catch (err) {
        console.error("Error fetching company:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompanyDetails();
  }, [companyId, status]);
  
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
  
  const confirmDeleteCompany = async () => {
    setDeleteLoading(true);
    
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmed: true })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete company');
      }
      
      // Success - redirect to dashboard
      alert('Company deleted successfully');
      router.push('/dashboard?tab=companies');
    } catch (error) {
      console.error('Error deleting company:', error);
      setDeleteError(error.message || 'An unknown error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!company) {
    return notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6">
        <Link href="/dashboard?tab=companies" className="text-blue-500 hover:underline">
          ← Back to Companies
        </Link>
      </nav>

      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            
            {session?.user?.role === UserRole.ADMIN && (
              <div className="flex space-x-2">
                <Link 
                  href={`/dashboard/companies/${companyId}/edit`}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Edit Company
                </Link>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDeleteClick}
                >
                  Delete Company
                </Button>
              </div>
            )}
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Email</h3>
              <p className="mt-1">{company.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p className="mt-1">{new Date(company.createdAt).toLocaleDateString()}</p>
            </div>
            
            {company.logo && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Company Logo</h3>
                <div className="w-40 h-40 border rounded-md overflow-hidden mt-2">
                  <img 
                    src={company.logo} 
                    alt={`${company.name} logo`} 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/placeholder-logo.png'; // Fallback image
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Employees</h2>
            <Link 
              href={`/dashboard/employees/create?companyId=${company.id}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Employee
            </Link>
          </div>

          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.subrole ? String(employee.subrole).toLowerCase().replace("_", " ") : "Employee"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.coins}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Link 
                            href={`/dashboard/employees/${employee.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No employees found for this company.</p>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Company Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {company?.name}? This action will delete the company and all associated employees. This cannot be undone.
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
            onClick={confirmDeleteCompany} 
            color="error" 
            disabled={deleteLoading}
            variant="contained"
          >
            {deleteLoading ? 'Deleting...' : 'Delete Company'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 