import { NextRequest, NextResponse } from "next/server";

/**
 * Wraps an API route handler with error handling for production
 * @param handler The API route handler function
 * @returns A wrapped handler with error handling
 */
export function withErrorHandling(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: any): Promise<NextResponse> => {
    try {
      // Call the original handler
      return await handler(req, context);
    } catch (error: any) {
      console.error(`API Error [${req.method} ${req.nextUrl.pathname}]:`, error);
      
      // Return a safely formatted error response
      return NextResponse.json(
        { 
          error: process.env.NODE_ENV === "production" 
            ? "An unexpected error occurred" 
            : error.message || "Unknown error"
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Creates a safe mock response for API routes when database fails
 */
export function createMockApiResponse(resourceType: string) {
  return NextResponse.json({ 
    data: [], 
    message: `Mock ${resourceType} data due to database configuration issues`,
    isMock: true
  });
} 