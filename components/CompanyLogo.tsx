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
  const [fixedUrl, setFixedUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (!logoUrl) {
      setFixedUrl(null);
      setDebugInfo("Logo URL: none");
      return;
    }
    
    // Fix URL if it doesn't start with a slash
    let url = logoUrl;
    if (url && !url.startsWith('/') && !url.startsWith('http')) {
      url = `/${url}`;
    }
    
    setFixedUrl(url);
    setDebugInfo(`Original URL: ${logoUrl} | Fixed URL: ${url}`);
    console.log("CompanyLogo processing logoUrl:", logoUrl, "→", url);
  }, [logoUrl]);
  
  if (!fixedUrl || error) {
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
          src={fixedUrl}
          alt={`${companyName} logo`}
          className="w-full h-full object-contain"
          onError={() => {
            console.error("Image failed to load:", fixedUrl);
            setError(true);
          }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
    </div>
  );
} 