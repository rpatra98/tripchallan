"use client";

import { useState } from 'react';
import Image from 'next/image';

interface CompanyLogoProps {
  logoUrl: string | null | undefined;
  companyName: string;
}

export default function CompanyLogo({ logoUrl, companyName }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  
  if (!logoUrl || error) {
    return <p className="text-gray-500 italic">Logo is not available</p>;
  }
  
  return (
    <div className="w-40 h-40 border rounded-md overflow-hidden">
      <img 
        src={logoUrl}
        alt={`${companyName} logo`}
        className="w-full h-full object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
} 