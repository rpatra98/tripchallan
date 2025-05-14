"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import Link from "next/link";

interface PermissionsForm {
  canCreate: boolean;
  canModify: boolean;
  canDelete: boolean;
}

export default function OperatorPermissionsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [employee, setEmployee] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsForm>({
    canCreate: true,
    canModify: false,
    canDelete: false
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch employee details
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Only ADMIN and SUPERADMIN can edit permissions
    if (
      !session?.user?.role ||
      (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN)
    ) {
      router.push("/dashboard");
      return;
    }

    fetchEmployeeDetails();
  }, [status, session, router, params.id]);

  const fetchEmployeeDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/employees/${params.id}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch employee details");
      }
      
      const data = await response.json();
      
      if (data.role !== UserRole.EMPLOYEE || data.subrole !== EmployeeSubrole.OPERATOR) {
        setError("This user is not an operator");
        return;
      }
      
      setEmployee(data);
      
      // Set permissions from employee data or defaults
      if (data.operatorPermissions) {
        setPermissions({
          canCreate: data.operatorPermissions.canCreate,
          canModify: data.operatorPermissions.canModify,
          canDelete: data.operatorPermissions.canDelete
        });
      }
    } catch (err) {
      console.error("Error fetching employee:", err);
      setError("Failed to load employee details");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/employees/${params.id}/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(permissions)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update permissions");
      }

      setSuccess("Permissions updated successfully");
      
      // Refresh employee data
      fetchEmployeeDetails();
    } catch (err) {
      console.error("Error updating permissions:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link 
          href={`/dashboard/employees/${params.id}`}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          &larr; Back to Employee Details
        </Link>
        <h1 className="text-2xl font-bold">Edit Operator Permissions</h1>
        {employee && (
          <p className="text-gray-600">
            {employee.name} ({employee.email})
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
          <p>{success}</p>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Trip/Session Permissions</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  id="canCreate"
                  name="canCreate"
                  type="checkbox"
                  checked={permissions.canCreate}
                  onChange={handlePermissionChange}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="canCreate" className="ml-3 text-gray-700">
                  Can Create New Trips/Sessions
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="canModify"
                  name="canModify"
                  type="checkbox"
                  checked={permissions.canModify}
                  onChange={handlePermissionChange}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="canModify" className="ml-3 text-gray-700">
                  Can Modify Existing Trips/Sessions
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  id="canDelete"
                  name="canDelete"
                  type="checkbox"
                  checked={permissions.canDelete}
                  onChange={handlePermissionChange}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="canDelete" className="ml-3 text-gray-700">
                  Can Delete Trips/Sessions
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-8">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Permissions"}
            </button>
            
            <Link
              href={`/dashboard/employees/${params.id}`}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 