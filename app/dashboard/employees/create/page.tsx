"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useSession } from "next-auth/react";

interface Company {
  id: string;
  name: string;
  companyUserId?: string;
}

export default function CreateEmployeePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyId: "",
    subrole: EmployeeSubrole.OPERATOR,
    coins: 200, // Default coins for operators
    permissions: {
      canCreate: true,
      canModify: false,
      canDelete: false
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  // Check user authorization
  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    // Only ADMIN and SUPERADMIN can create employees
    if (session?.user?.role !== UserRole.ADMIN && session?.user?.role !== UserRole.SUPERADMIN) {
      setUnauthorized(true);
      return;
    }

    // Fetch companies if authorized
    fetchCompanies();
  }, [status, session, router]);

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
    
    if (type === "checkbox") {
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!formData.companyId) {
      setError("Please select a company");
      setIsLoading(false);
      return;
    }

    try {
      // Log request payload
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: UserRole.EMPLOYEE,
        subrole: formData.subrole,
        companyId: formData.companyId,
        coins: formData.subrole === EmployeeSubrole.OPERATOR ? formData.coins : undefined,
        permissions: formData.subrole === EmployeeSubrole.OPERATOR ? formData.permissions : undefined
      };
      console.log("Sending employee creation request:", payload);
      
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      // Show success message
      alert("Employee created successfully!");
      
      // Redirect to dashboard on success
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Error creating employee:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // If unauthorized, show unauthorized message
  if (unauthorized) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-red-600">Unauthorized Access</h1>
        <p className="mb-4">You do not have permission to create employees. Only administrators can add employees to companies.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // If still loading session status, show loading
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Create Employee</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Employee Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 focus:outline-none"
            >
              {showPassword ? (
                <FaEyeSlash className="h-5 w-5" />
              ) : (
                <FaEye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 focus:outline-none"
            >
              {showConfirmPassword ? (
                <FaEyeSlash className="h-5 w-5" />
              ) : (
                <FaEye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          <select
            id="companyId"
            name="companyId"
            required
            value={formData.companyId}
            onChange={handleChange}
            disabled={isLoadingCompanies}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.companyUserId || company.id}>
                {company.name}
              </option>
            ))}
          </select>
          {isLoadingCompanies && (
            <p className="text-sm text-gray-500 mt-1">Loading companies...</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor="subrole" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="subrole"
            name="subrole"
            required
            value={formData.subrole}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={EmployeeSubrole.OPERATOR}>Operator</option>
            <option value={EmployeeSubrole.DRIVER}>Driver</option>
            <option value={EmployeeSubrole.TRANSPORTER}>Transporter</option>
            <option value={EmployeeSubrole.GUARD}>Guard</option>
          </select>
        </div>

        {formData.subrole === EmployeeSubrole.OPERATOR && (
          <>
            {/* Note for operator permissions */}
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md">
              <p className="text-sm">
                <strong>Note:</strong> When creating an operator, be sure to set the appropriate permissions.
                These permissions determine what actions the operator can perform and can be edited later.
              </p>
            </div>
            
            <div className="mb-4">
              <label htmlFor="coins" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Coins
              </label>
              <input
                id="coins"
                name="coins"
                type="number"
                min="1"
                required
                value={formData.coins}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Default: 200 coins. This amount will be deducted from your balance.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operator Permissions
              </label>
              <div className="space-y-2 p-4 border-2 border-blue-200 rounded-md bg-blue-50">
                <div className="flex items-center">
                  <input
                    id="permission_canCreate"
                    name="permission_canCreate"
                    type="checkbox"
                    checked={formData.permissions.canCreate}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="permission_canCreate" className="ml-2 block text-sm text-gray-900">
                    Can Create Trips/Sessions
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="permission_canModify"
                    name="permission_canModify"
                    type="checkbox"
                    checked={formData.permissions.canModify}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="permission_canModify" className="ml-2 block text-sm text-gray-900">
                    Can Modify Trips/Sessions
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="permission_canDelete"
                    name="permission_canDelete"
                    type="checkbox"
                    checked={formData.permissions.canDelete}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="permission_canDelete" className="ml-2 block text-sm text-gray-900">
                    Can Delete Trips/Sessions
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  These permissions determine what actions this operator can perform on trips.
                </p>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isLoading || isLoadingCompanies}
          className={`w-full py-2 px-4 rounded-md text-white font-medium 
            ${(isLoading || isLoadingCompanies) ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {isLoading ? "Creating..." : "Create Employee"}
        </button>
      </form>
    </div>
  );
} 