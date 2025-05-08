"use client";

import { useEffect, useState, Suspense } from "react";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Typography, CircularProgress, Button } from "@mui/material";

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>("Logging out...");
  const [error, setError] = useState<boolean>(false);
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  
  // Perform client-side logout and redirect
  useEffect(() => {
    async function performLogout() {
      try {
        // Step 1: Clear all cookies
        setStatus("Clearing cookies...");
        document.cookie.split(";").forEach(cookie => {
          const name = cookie.split("=")[0].trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            // Also clear domain-specific cookies
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          }
        });
        
        // Step 2: Clear local storage
        try {
          setStatus("Clearing local storage...");
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error("Error clearing storage:", e);
        }
        
        // Step 3: Call NextAuth signOut with redirect:false
        setStatus("Clearing session data...");
        await signOut({ redirect: false });
        
        // Step 4: Redirect to our API logout handler which will clear server-side cookies
        setStatus("Redirecting...");
        
        // Use fetch to hit the logout API endpoint first
        try {
          await fetch(`/api/auth/logout?callbackUrl=${encodeURIComponent(callbackUrl)}`, {
            method: 'GET',
            credentials: 'include' // Important for cookies
          });
        } catch (err) {
          console.warn("API logout fetch error (continuing anyway):", err);
        }
        
        // Final hard redirect to ensure all state is reset
        window.location.href = callbackUrl;
      } catch (error) {
        console.error("Logout error:", error);
        setStatus("Error during logout. Please try again.");
        setError(true);
      }
    }
    
    performLogout();
  }, [callbackUrl, router]);
  
  const handleRetry = () => {
    setStatus("Retrying logout...");
    setError(false);
    // Force reload the page to try again
    window.location.reload();
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default'
      }}
    >
      {error ? (
        <>
          <Typography variant="h5" color="error" gutterBottom>
            Logout Failed
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            There was a problem signing you out. Please try again.
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleRetry}
          >
            Retry Logout
          </Button>
        </>
      ) : (
        <>
          <CircularProgress size={48} sx={{ mb: 4 }} />
          <Typography variant="h5" gutterBottom>
            {status}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Please wait while we sign you out securely.
          </Typography>
        </>
      )}
    </Box>
  );
}

export default function LogoutPage() {
  return (
    <Suspense fallback={
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress size={48} sx={{ mb: 4 }} />
        <Typography variant="h5" gutterBottom>
          Loading...
        </Typography>
      </Box>
    }>
      <LogoutContent />
    </Suspense>
  );
} 