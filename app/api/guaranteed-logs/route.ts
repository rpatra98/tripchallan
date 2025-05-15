import { NextResponse } from "next/server";

/**
 * Emergency API endpoint that always returns some activity log data
 * Use this if no other data source is working
 */
export async function GET() {
  // Create static sample data
  const mockLogs = [
    {
      id: "mock-1",
      action: "LOGIN",
      targetResourceType: "SESSION",
      targetResourceId: "session-123",
      userId: "user-123",
      createdAt: new Date().toISOString(),
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      details: { device: "desktop" },
      user: {
        id: "user-123",
        name: "Demo User",
        email: "demo@example.com",
        role: "ADMIN"
      }
    },
    {
      id: "mock-2",
      action: "CREATE",
      targetResourceType: "USER",
      targetResourceId: "user-456",
      userId: "user-123",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      details: { 
        userName: "New User",
        userEmail: "new@example.com",
        userRole: "EMPLOYEE"
      },
      user: {
        id: "user-123",
        name: "Demo User",
        email: "demo@example.com",
        role: "ADMIN"
      },
      targetUser: {
        id: "user-456",
        name: "New User",
        email: "new@example.com",
        role: "EMPLOYEE"
      }
    },
    {
      id: "mock-3",
      action: "UPDATE",
      targetResourceType: "COMPANY",
      targetResourceId: "company-123",
      userId: "user-123",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      details: { 
        companyName: "Updated Company",
        summaryText: "Updated company details"
      },
      user: {
        id: "user-123",
        name: "Demo User",
        email: "demo@example.com",
        role: "ADMIN"
      }
    },
    {
      id: "mock-4",
      action: "ALLOCATE",
      targetResourceType: "COINS",
      targetResourceId: "transaction-123",
      userId: "user-123", 
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      details: {
        amount: 500,
        recipientName: "Employee User"
      },
      user: {
        id: "user-123",
        name: "Demo User",
        email: "demo@example.com",
        role: "ADMIN"
      }
    },
    {
      id: "mock-5",
      action: "VIEW",
      targetResourceType: "USER_LIST",
      userId: "user-123",
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      details: {
        filters: { role: "EMPLOYEE" },
        resultCount: 25
      },
      user: {
        id: "user-123",
        name: "Demo User",
        email: "demo@example.com",
        role: "ADMIN"
      }
    }
  ];

  console.log("Returning guaranteed mock logs:", mockLogs.length);
  
  return NextResponse.json({
    logs: mockLogs,
    meta: {
      currentPage: 1,
      totalPages: 1,
      totalItems: mockLogs.length,
      itemsPerPage: mockLogs.length,
      hasNextPage: false,
      hasPrevPage: false
    }
  });
}