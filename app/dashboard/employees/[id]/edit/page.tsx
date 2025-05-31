"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { EmployeeSubrole, UserRole } from "@/lib/enums";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { SessionUpdateContext } from "@/app/dashboard/layout";

interface Company {
  id: string;
  name: string;
  companyUserId?: string;
}

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  subrole?: string | null;
  companyId?: string | null;
  coins: number;
  company?: {
    id: string;
    name: string;
  } | null;
  operatorPermissions?: {
    canCreate: boolean;
    canModify: boolean;
    canDelete: boolean;
  } | null;
}

export default function EditEmployeePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyId: "",
    subrole: EmployeeSubrole.OPERATOR,
    coins: 200,
    permissions: {
      canCreate: true,
      canModify: false,
      canDelete: false
    },
    confirmPermissions: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  // Check user authorization
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Only ADMIN and SUPERADMIN can edit employees
    if (session?.user?.role !== UserRole.ADMIN && session?.user?.role !== UserRole.SUPERADMIN) {
      setUnauthorized(true);
      return;
    }

    // Fetch companies if authorized
    fetchCompanies();
    
    // Fetch employee data
    fetchEmployeeData();
  }, [status, session, router, params.id]);

  // Fetch employee data
  const fetchEmployeeData = async () => {
    try {
      setIsLoadingEmployee(true);
      const response = await fetch(`/api/employees/${params.id}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch employee data");
      }
      
      const data = await response.json();
      console.log("Fetched employee:", data);
      
      // Update form data with employee details
      setFormData({
        name: data.name || "",
        email: data.email || "",
        password: "",
        confirmPassword: "",
        companyId: data.companyId || "",
        subrole: data.subrole || EmployeeSubrole.OPERATOR,
        coins: data.coins || 0,
        permissions: {
          canCreate: data.operatorPermissions?.canCreate || false,
          canModify: data.operatorPermissions?.canModify || false,
          canDelete: data.operatorPermissions?.canDelete || false
        },
        confirmPermissions: true
      });
    } catch (err) {
      console.error("Error fetching employee data:", err);
      setError("Failed to load employee data. Please try again later.");
    } finally {
      setIsLoadingEmployee(false);
    }
  };

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      setIsLoadingCompanies(true);
      const response = await fetch("/api/companies");
      
      if (!response.ok) {
        throw new Error("Failed to fetch companies");
      }
      
      const data = await response.json();
      console.log("Fetched companies:", JSON.stringify(data, null, 2));
      
      if (data.length === 0) {
        console.warn("No companies available for this admin");
        setError("No companies available. Please create a company first.");
      }
      
      setCompanies(data);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError("Failed to load companies. Please try again later.");
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (name === "confirm_permissions") {
      // Handle confirmation checkbox
      const isChecked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        confirmPermissions: isChecked
      }));
    } else if (type === "checkbox") {
      if (name === "change_password") {
        setChangePassword((e.target as HTMLInputElement).checked);
      } else {
        // Handle checkbox for permissions
        const isChecked = (e.target as HTMLInputElement).checked;
        const permissionName = name.replace("permission_", "");
        
        setFormData(prev => ({
          ...prev,
          permissions: {
            ...prev.permissions,
            [permissionName]: isChecked
          }
        }));
      }
    } else if (name === "coins") {
      // For coins field, convert the value to a number
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation for password change
    if (changePassword) {
      if (!formData.password) {
        setError("Password is required");
        setIsLoading(false);
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }
    }

    if (!formData.companyId) {
      setError("Please select a company");
      setIsLoading(false);
      return;
    }

    // Validate that at least one permission is set for operators
    if (formData.subrole === EmployeeSubrole.OPERATOR) {
      const hasPermission = 
        formData.permissions.canCreate || 
        formData.permissions.canModify || 
        formData.permissions.canDelete;
      
      if (!hasPermission) {
        setError("You must enable at least one permission for the operator");
        setIsLoading(false);
        return;
      }

      if (!formData.confirmPermissions) {
        setError("You must confirm that you have set the appropriate permissions");
        setIsLoading(false);
        return;
      }
    }

    try {
      // Log request payload
      const payload: any = {
        name: formData.name,
        email: formData.email,
        subrole: formData.subrole,
        companyId: formData.companyId,
        coins: formData.coins,
        permissions: formData.subrole === EmployeeSubrole.OPERATOR ? formData.permissions : undefined
      };
      
      // Only include password if it's being changed
      if (changePassword && formData.password) {
        payload.password = formData.password;
      }
      
      console.log("Sending employee update request:", payload);
      
      // Store the original employee data for comparison
      const originalEmployee = await fetch(`/api/employees/${params.id}`).then(res => res.json());
      const hadCoinsChange = originalEmployee.coins !== formData.coins;
      
      const response = await fetch(`/api/employees/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to update employee");
      }

      // Update session if coins have changed
      if (hadCoinsChange) {
        await refreshUserSession();
      }

      // Show success message
      alert("Employee updated successfully!");
      
      // Redirect to employee details page
      router.push(`/dashboard/employees/${params.id}`);
      router.refresh();
    } catch (err: any) {
      console.error("Error updating employee:", err);
      setError(err.message || "Failed to update employee. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (unauthorized) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p>You do not have permission to edit employees.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingEmployee || isLoadingCompanies) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/dashboard/employees/${params.id}`} className="text-blue-600 hover:underline mb-4 inline-block">
          &larr; Back to Employee Details
        </Link>
        <h1 className="text-2xl font-bold">Edit Employee</h1>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center mb-4">
                <input 
                  type="checkbox" 
                  name="change_password"
                  checked={changePassword}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-gray-700">Change password</span>
              </label>
            </div>

            {changePassword && (
              <>
                <div className="relative">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 px-3 flex items-center"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute inset-y-0 right-0 px-3 flex items-center"
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Company
              </label>
              <select
                name="companyId"
                value={formData.companyId}
                onChange={handleChange}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
              >
                <option value="">Select Company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Role
              </label>
              <select
                name="subrole"
                value={formData.subrole}
                onChange={handleChange}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-white"
              >
                <option value={EmployeeSubrole.OPERATOR}>Operator</option>
                <option value={EmployeeSubrole.DRIVER}>Driver</option>
                <option value={EmployeeSubrole.GUARD}>Guard</option>
                <option value={EmployeeSubrole.TRANSPORTER}>Transporter</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Coins
              </label>
              <input
                type="number"
                name="coins"
                value={formData.coins}
                onChange={handleChange}
                min="0"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>

          {formData.subrole === EmployeeSubrole.OPERATOR && (
            <div className="mb-6 bg-blue-50 p-4 rounded-md">
              <h3 className="text-lg font-semibold mb-2">Operator Permissions</h3>
              <p className="mb-4 text-gray-600 text-sm">
                Operators need specific permissions to perform actions in the system.
              </p>
              
              <div className="mb-4">
                <label className="flex items-center mb-2">
                  <input 
                    type="checkbox" 
                    name="permission_canCreate"
                    checked={formData.permissions.canCreate}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>Can create trips/sessions</span>
                </label>
                
                <label className="flex items-center mb-2">
                  <input 
                    type="checkbox" 
                    name="permission_canModify"
                    checked={formData.permissions.canModify}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>Can modify trips/sessions</span>
                </label>
                
                <label className="flex items-center mb-2">
                  <input 
                    type="checkbox" 
                    name="permission_canDelete"
                    checked={formData.permissions.canDelete}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span>Can delete trips/sessions</span>
                </label>
              </div>
              
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  name="confirm_permissions"
                  checked={formData.confirmPermissions}
                  onChange={handleChange}
                  className="mr-2"
                  required
                />
                <span className="text-sm">I confirm that I have set the appropriate permissions for this operator</span>
              </label>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              href={`/dashboard/employees/${params.id}`}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 