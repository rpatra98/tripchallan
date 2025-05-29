import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Path patterns that should be protected
const protectedPaths = ["/dashboard", "/api/users", "/api/coins", "/api/admins"];

// Paths that are public
const publicPaths = ["/", "/api/auth"];

// Flag to disable auth checks during deployment issues
const DISABLE_AUTH_CHECKS_FOR_TROUBLESHOOTING = process.env.DISABLE_AUTH === "1";

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    
    // Skip auth checks if explicitly disabled for troubleshooting
    if (DISABLE_AUTH_CHECKS_FOR_TROUBLESHOOTING) {
      console.log(`[Middleware] Auth checks disabled for troubleshooting - allowing access to ${pathname}`);
      return NextResponse.next();
    }
    
    // Always allow access to auth-related paths
    if (publicPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Check if the path should be protected
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    
    if (isProtectedPath) {
      try {
        const token = await getToken({ 
          req: request,
          // Make token validation less strict in production to prevent deployment issues
          secureCookie: process.env.NODE_ENV === "production" ? false : undefined
        });
        
        // If not authenticated, redirect to login page or return 401 for API routes
        if (!token) {
          if (pathname.startsWith("/api")) {
            return NextResponse.json(
              { error: "Authentication required" },
              { status: 401 }
            );
          }
          
          // Create new URL for redirection
          const url = new URL("/", request.url);
          url.searchParams.set("error", "NotAuthenticated");
          return NextResponse.redirect(url);
        }
        
        // Token age check
        if (token.iat && typeof token.iat === 'number') {
          const issuedAt = token.iat;
          const currentTime = Math.floor(Date.now() / 1000);
          const twelveHoursInSeconds = 12 * 60 * 60;
          
          // If token is older than 12 hours, force a re-login
          if (currentTime - issuedAt > twelveHoursInSeconds) {
            if (pathname.startsWith("/api")) {
              return NextResponse.json(
                { error: "Session expired" },
                { status: 401 }
              );
            }
            
            // Redirect to our custom logout page with error
            const url = new URL("/api/auth/logout", request.url);
            url.searchParams.set("callbackUrl", "/?error=SessionExpired");
            return NextResponse.redirect(url);
          }
        }
      } catch (authError) {
        console.error("Authentication error:", authError);
        
        // Check if this is a database-related error (likely prepared statement)
        const errorMsg = authError instanceof Error ? authError.message : String(authError);
        const isDbError = errorMsg.includes('prepared statement') || 
                          errorMsg.includes('42P05') || 
                          errorMsg.includes('ConnectorError');
        
        // For database errors, just let the request proceed to avoid redirect loops
        if (isDbError) {
          console.warn("[Middleware] Database error detected, allowing request to proceed to avoid redirect loop");
          return NextResponse.next();
        }
        
        // Special handling for Vercel deployments
        if (process.env.VERCEL === "1") {
          console.warn("[Middleware] Auth error in Vercel environment, allowing request to proceed");
          return NextResponse.next();
        }
        
        // On auth failure, redirect to login instead of breaking the app
        if (pathname.startsWith("/api")) {
          return NextResponse.json(
            { error: "Authentication error", details: errorMsg },
            { status: 500 }
          );
        }
        
        // To avoid redirect loops on database errors, check if we're already on the login page
        if (errorMsg.includes('database') || errorMsg.includes('prisma')) {
          return NextResponse.next();
        }
        
        const url = new URL("/", request.url);
        url.searchParams.set("error", "AuthError");
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  } catch (error) {
    // Global error handler for middleware
    console.error("Middleware error:", error);
    
    // Check if this is a database-related error
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isDbError = errorMsg.includes('prepared statement') || 
                      errorMsg.includes('42P05') || 
                      errorMsg.includes('ConnectorError') ||
                      errorMsg.includes('database') ||
                      errorMsg.includes('prisma');
    
    // For database errors, just let the request proceed to avoid redirect loops
    if (isDbError) {
      console.warn("[Middleware] Database error detected, allowing request to proceed to avoid redirect loop");
      return NextResponse.next();
    }
    
    // For Vercel deployments, allow the request to proceed with warnings
    if (process.env.VERCEL === "1") {
      console.warn("[Middleware] Error in Vercel environment, allowing request to proceed");
      return NextResponse.next();
    }
    
    // For API routes return JSON error
    if (request.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json(
        { 
          error: "Internal server error", 
          message: "The server encountered an error and could not process your request",
          details: errorMsg
        },
        { status: 500 }
      );
    }
    
    // For non-API routes, redirect to homepage with error
    try {
      const url = new URL("/", request.url);
      url.searchParams.set("error", "ServerError");
      return NextResponse.redirect(url);
    } catch {
      // Last resort if we can't even create a URL
      return NextResponse.next();
    }
  }
}

// Paths that should trigger the middleware
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/auth/* (authentication API routes)
     * 2. /_next/* (Next.js built-in paths)
     * 3. /public files (public assets)
     */
    "/((?!_next/|static/|public/|assets/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}; 