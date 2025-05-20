import { NextResponse } from "next/server";

// This handles NextAuth signOut() function calls
export async function POST(request: Request) {
  try {
    // Check content type to handle different types of requests
    const contentType = request.headers.get('content-type') || '';
    
    let callbackUrl = '/';
    
    if (contentType.includes('application/json')) {
      // Handle JSON request body
      const body = await request.json();
      callbackUrl = body?.callbackUrl || '/';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Handle form data
      const formData = await request.formData();
      callbackUrl = formData.get('callbackUrl')?.toString() || '/';
    } else {
      // Try to read as text and see if it's parseable
      try {
        const text = await request.text();
        
        // Check if it looks like URL-encoded form data
        if (text.includes('=')) {
          const params = new URLSearchParams(text);
          callbackUrl = params.get('callbackUrl') || '/';
        }
        // Don't attempt to parse as JSON if it doesn't look like JSON
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
      }
    }
    
    // Return JSON with the URL to redirect to
    return NextResponse.json({ url: callbackUrl });
  } catch (error) {
    console.error('Error in signout handler:', error);
    return NextResponse.json({ url: '/' });
  }
}

// This manually clears auth cookies and redirects for browser navigation
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/";

    // Check if this is an API request expecting JSON (from NextAuth)
    const acceptHeader = request.headers.get("accept");
    if (acceptHeader && acceptHeader.includes("application/json")) {
      // Return JSON for NextAuth signOut() function
      return NextResponse.json({ url: callbackUrl });
    }
    
    // For browser requests, just redirect to the logout page with the callback
    return NextResponse.redirect(new URL(`/api/auth/logout?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url));
  } catch (error) {
    console.error('Error in signout GET handler:', error);
    // If there's an error, redirect to home page
    return NextResponse.redirect(new URL('/', request.url));
  }
} 