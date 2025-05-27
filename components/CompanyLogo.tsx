"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface CompanyLogoProps {
  logoUrl: string | null | undefined;
  companyName: string;
}

export default function CompanyLogo({ logoUrl, companyName }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  useEffect(() => {
    // Debug info to help troubleshoot
    setDebugInfo(`Logo URL: ${logoUrl || "none"}`);
    console.log("CompanyLogo received logoUrl:", logoUrl);
  }, [logoUrl]);
  
  if (!logoUrl || error) {
    return (
      <div>
        <p className="text-gray-500 italic">Logo is not available</p>
        <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="w-40 h-40 border rounded-md overflow-hidden">
        <img 
          src={logoUrl}
          alt={`${companyName} logo`}
          className="w-full h-full object-contain"
          onError={() => {
            console.error("Image failed to load:", logoUrl);
            setError(true);
          }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
    </div>
  );
} 