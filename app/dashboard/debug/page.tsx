"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function DebugNavigationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Extract navigation parameters
    const employeeId = searchParams.get("employeeId");
    const source = searchParams.get("source");
    
    console.log("Debug navigation triggered", {
      employeeId,
      source,
      searchParams: Object.fromEntries(searchParams.entries()),
      url: window.location.href,
    });
    
    // After a short delay, navigate to the employee details page
    if (employeeId) {
      const timeout = setTimeout(() => {
        const url = `/dashboard/employees/${employeeId}`;
        console.log(`Navigating to: ${url}`);
        window.location.href = url;
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [router, searchParams]);
  
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Navigation</h1>
      <p className="mb-2">Preparing navigation to employee details...</p>
      <p className="text-sm text-gray-500">You will be redirected automatically in a moment.</p>
    </div>
  );
} 