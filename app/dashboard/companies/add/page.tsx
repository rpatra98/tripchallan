"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyAddRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the correct URL
    router.replace("/dashboard/companies/create");
  }, [router]);

  // Return a simple loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg text-gray-600">Redirecting to company creation page...</p>
    </div>
  );
} 