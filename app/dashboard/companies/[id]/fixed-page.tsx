import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import Link from "next/link";
import CompanyActions from "./company-actions";

// Add dynamic export to ensure Next.js treats this as a dynamic route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Add employee interface
interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string;
  coins?: number;
}

// Company interface
interface Company {
  id: string;
  name: string;
  email: string;
  coins?: number;
  createdAt: Date | string;
  updatedAt?: Date | string;
  isActive?: boolean;
  companyType?: string;
  gstin?: string;
  phone?: string;
  address?: string;
  logo?: string;
  documents?: string[];
  _synthetic?: boolean;
  employees?: Employee[];
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  // Get and decode the ID from params
  let companyId = params.id;
  
  // Try to decode the ID in case it has encoding issues
  try {
    companyId = decodeURIComponent(companyId);
  } catch (e) {
    console.error("Failed to decode company ID:", e);
    // Continue with the original ID
  }
  
  console.log(`Company detail page - ID from params: "${companyId}" - Length: ${companyId?.length || 0}`);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      redirect("/");
    }

    // Get user with detailed information
    const dbUser = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    });

    if (!dbUser) {
      redirect("/");
    }

    // Check authorization - only ADMIN and SUPERADMIN can view
    if (dbUser.role !== UserRole.ADMIN && dbUser.role !== UserRole.SUPERADMIN) {
      redirect("/dashboard");
    }

    // Check if ID might be truncated (usually UUIDs are 36 chars with hyphens)
    const potentiallyTruncated = companyId.length > 0 && companyId.length < 30;
    if (potentiallyTruncated) {
      console.log(`Potentially truncated ID detected: ${companyId}`);
      
      // Try to find a matching company by partial ID
      try {
        // First check if any company starts with this ID
        const companies = await prisma.company.findMany({
          where: {
            id: {
              startsWith: companyId
            }
          },
          take: 1
        });
        
        if (companies.length > 0) {
          // Found a matching company - redirect to its correct URL
          const fullId = companies[0].id;
          console.log(`Found matching company with full ID: ${fullId}`);
          redirect(`/dashboard/companies/${fullId}`);
          return null; // Not reached due to redirect
        }
        
        // No company found with ID starting with the provided prefix
        // Now try to find matching company users (COMPANY role)
        const companyUsers = await prisma.user.findMany({
          where: {
            id: {
              startsWith: companyId
            },
            role: UserRole.COMPANY
          },
          take: 1
        });
        
        if (companyUsers.length > 0) {
          // Found a matching company user - redirect to its correct URL
          const fullId = companyUsers[0].id;
          console.log(`Found matching company user with full ID: ${fullId}`);
          redirect(`/dashboard/companies/${fullId}`);
          return null; // Not reached due to redirect
        }
      } catch (searchError) {
        console.error("Error searching for company by partial ID:", searchError);
        // Continue with the original flow - we'll show an error page if needed
      }
    }

    // Get company data directly from database
    let company: Company | null = null;
    let error: string | null = null;
    
    try {
      // Try direct company lookup
      const dbCompany = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
          employees: {
            where: { role: UserRole.EMPLOYEE },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              subrole: true,
              coins: true,
            }
          }
        }
      });
      
      if (dbCompany) {
        company = {
          ...dbCompany,
          createdAt: dbCompany.createdAt.toISOString(),
          updatedAt: dbCompany.updatedAt.toISOString(),
          employees: dbCompany.employees
        };
      } else {
        // Try company user lookup
        const companyUser = await prisma.user.findFirst({
          where: {
            id: companyId,
            role: UserRole.COMPANY
          },
          select: {
            id: true,
            name: true,
            email: true,
            companyId: true,
            coins: true,
            createdAt: true,
            updatedAt: true
          }
        });
        
        if (companyUser) {
          if (companyUser.companyId) {
            // Get related company
            const relatedCompany = await prisma.company.findUnique({
              where: { id: companyUser.companyId },
              include: {
                employees: {
                  where: { role: UserRole.EMPLOYEE },
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    subrole: true,
                    coins: true
                  }
                }
              }
            });
            
            if (relatedCompany) {
              company = {
                ...relatedCompany,
                createdAt: relatedCompany.createdAt.toISOString(),
                updatedAt: relatedCompany.updatedAt.toISOString(),
                employees: relatedCompany.employees
              };
            }
          }
          
          // If still no company, create synthetic one
          if (!company) {
            // Get employees for this company user
            const employees = await prisma.user.findMany({
              where: { 
                companyId: companyUser.id,
                role: UserRole.EMPLOYEE
              },
              select: {
                id: true,
                name: true,
                email: true,
                subrole: true,
                coins: true,
              }
            });
            
            company = {
              id: companyUser.id,
              name: companyUser.name,
              email: companyUser.email,
              createdAt: companyUser.createdAt.toISOString(),
              updatedAt: companyUser.updatedAt.toISOString(),
              employees: employees,
              isActive: true,
              coins: companyUser.coins || 0,
              _synthetic: true
            };
          }
        }
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      error = dbError instanceof Error ? dbError.message : String(dbError);
    }

    // If we still don't have company data, show an error
    if (!company) {
      return (
        <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
          <h1 className="text-2xl font-bold text-red-700">Company Not Found</h1>
          <p className="mt-2">The company with ID: {companyId} was not found or could not be accessed.</p>
          {error && <p className="mt-2 text-red-600">Error details: {error}</p>}
          <div className="mt-4 flex space-x-4">
            <Link href="/dashboard" className="text-blue-600 hover:underline">
              &larr; Go back to Dashboard
            </Link>
            <Link href="/dashboard/companies" className="text-blue-600 hover:underline">
              View All Companies
            </Link>
          </div>
        </div>
      );
    }
    
    // Get employees for this company
    const employees = Array.isArray(company.employees) ? company.employees : [];

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
            &larr; Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              <p className="text-gray-600">{company.email}</p>
              {company._synthetic && (
                <p className="text-amber-600 text-sm mt-1">
                  Note: Using company user data, actual company record may be missing
                </p>
              )}
            </div>
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                company.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {company.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Company Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">ID</p>
              <p className="font-mono text-sm">{company?.id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Company Type</p>
              <p>{company?.companyType || "--Others--"}</p>
            </div>
            <div>
              <p className="text-gray-600">Created On</p>
              <p>{company?.createdAt ? new Date(company.createdAt).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              }) : 'N/A'}</p>
            </div>
            {company?.gstin && (
              <div>
                <p className="text-gray-600">GSTIN</p>
                <p>{company.gstin}</p>
              </div>
            )}
            {company?.phone && (
              <div>
                <p className="text-gray-600">Phone Number</p>
                <p>{company.phone}</p>
              </div>
            )}
            {company?.address && (
              <div>
                <p className="text-gray-600">Address</p>
                <p>{company.address}</p>
              </div>
            )}
            {company?.coins !== undefined && (
              <div>
                <p className="text-gray-600">Coins</p>
                <p>{company.coins}</p>
              </div>
            )}
          </div>

          {company?.logo && (
            <div className="mt-4">
              <p className="text-gray-600 mb-2">Company Logo</p>
              <div className="w-40 h-40 border rounded-md overflow-hidden">
                <img 
                  src={company.logo} 
                  alt={`${company.name} logo`} 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const imgElement = e.target as HTMLImageElement;
                    imgElement.onerror = null;
                    imgElement.src = '/placeholder-logo.png'; // Fallback image
                  }}
                />
              </div>
            </div>
          )}

          {company?.documents && Array.isArray(company.documents) && company.documents.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-600 mb-2">Documents</p>
              <div className="flex flex-wrap gap-2">
                {company.documents.map((doc, index) => (
                  <a 
                    href={doc} 
                    key={index}
                    download
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Document {index + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <CompanyActions 
              companyId={company?.id || companyId} 
              companyName={company?.name || 'Company'} 
              isActive={company?.isActive !== undefined ? company.isActive : true}
            />
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Employees</h2>
            <Link 
              href={`/dashboard/employees/create?companyId=${company.id}`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Employee
            </Link>
          </div>

          {employees.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No employees found for this company.</p>
          ) : (
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
                  {employees.map((employee: Employee) => (
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
                        {employee.coins ?? 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Link 
                          href={`/dashboard/employees/${employee.id}?source=company&companyId=${company.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error in company details page:", error);
    return (
      <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Error</h1>
        <p className="mt-2">An error occurred while trying to fetch company details.</p>
        <p className="mt-2 text-red-500">{error instanceof Error ? error.message : String(error)}</p>
        <div className="mt-4 flex space-x-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            &larr; Go back to Dashboard
          </Link>
          <Link href="/dashboard/companies" className="text-blue-600 hover:underline">
            View All Companies
          </Link>
          <Link 
            href={`/dashboard/companies/${companyId}`}
            className="text-blue-600 hover:underline"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }
} 