import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import prismaHelper from "@/lib/prisma-helper";
import { UserRole } from "@/prisma/enums";
import SessionErrorPage from "@/components/SessionErrorPage";

// Dynamically import dashboard components
import SuperAdminDashboard from "@/components/dashboard/SuperAdminDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import CompanyDashboard from "@/components/dashboard/CompanyDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

// Add dynamic export to ensure Next.js treats this as a dynamic route
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // Reset Prisma connection before any operations
  await prismaHelper.resetConnection();
  
  // Get session data
  const session = await getServerSession(authOptions);
  
  // Extract tab parameter if present
  const tab = searchParams?.tab as string | undefined;
  
  // If there's a reset parameter, clear session errors
  const isReset = searchParams?.reset === 'true';

  // If no session or user ID, show session error instead of redirect
  if (!session || !session.user || !session.user.id) {
    console.log("No valid session found, showing session error page");
    return <SessionErrorPage />;
  }

  try {
    console.log(`Fetching user with ID: ${session.user.id}`);
    
    // Get user with additional info using prisma helper
    const dbUser = await prismaHelper.executePrismaWithRetry(async () => {
      return prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
        include: {
          company: true,
        },
      });
    });

    // If user not found in database, show error page
    if (!dbUser) {
      console.log(`User with ID ${session.user.id} not found in database`);
      return <SessionErrorPage />;
    }

    console.log(`User found with role: ${dbUser.role}`);
    
    // Cast the user object to handle type compatibility issues
    // This is necessary because there might be differences between Prisma's enums and our local enums
    const user = dbUser as any;
    
    // Render appropriate dashboard based on user role
    switch (dbUser.role) {
      case 'SUPERADMIN':
        return <SuperAdminDashboard user={user} />;
      case 'ADMIN':
        return <AdminDashboard user={user} />;
      case 'COMPANY':
        // Pass the tab parameter explicitly to the CompanyDashboard component
        console.log(`Rendering CompanyDashboard with tab: ${tab || 'default'}`);
        return <CompanyDashboard user={user} initialTab={tab || 'sessions'} />;
      case 'EMPLOYEE':
        return <EmployeeDashboard user={user} />;
      default:
        console.log(`Invalid role: ${dbUser.role}`);
        return <SessionErrorPage invalidRole={true} />;
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    
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
    
    // Show a specific error component
    return (
      <div className="container mx-auto px-4 py-8 bg-red-50 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700">Dashboard Error</h1>
        <p className="mt-2">An error occurred while trying to load your dashboard.</p>
        <p className="mt-2 text-red-500">{errorMessage}</p>
        <div className="mt-4 flex space-x-4">
          <a href="/dashboard" className="text-blue-600 hover:underline">
            Try Again
          </a>
          <a href="/" className="text-blue-600 hover:underline">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }
} 