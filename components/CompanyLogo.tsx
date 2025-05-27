"use client";

import { useState, useEffect } from 'react';

interface CompanyLogoProps {
  logoUrl: string | null | undefined;
  companyName: string;
}

export default function CompanyLogo({ logoUrl, companyName }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [fixedUrl, setFixedUrl] = useState<string | null>(null);
  
  // Get first letter for the avatar (fallback)
  const firstLetter = companyName?.charAt(0)?.toUpperCase() || "C";
  
  // Generate a consistent background color based on company name
  const getBgColor = () => {
    if (!companyName) return "#f0f0f0";
    
    // Simple hash function for the company name
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
      hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert to RGB color - pastel range
    const r = ((hash & 0xFF0000) >> 16) % 200 + 55;  // 55-255
    const g = ((hash & 0x00FF00) >> 8) % 200 + 55;   // 55-255
    const b = (hash & 0x0000FF) % 200 + 55;          // 55-255
    
    return `rgb(${r}, ${g}, ${b})`;
  };
  
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
  
  const handleImageError = () => {
    console.error("Image failed to load:", fixedUrl);
    setError(true);
  };
  
  if (!fixedUrl || error) {
    // Letter avatar fallback
    return (
      <div>
        <div 
          className="w-40 h-40 border rounded-md overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: getBgColor() }}
        >
          <span className="text-white text-6xl font-bold">{firstLetter}</span>
        </div>
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
          onError={handleImageError}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{debugInfo}</p>
    </div>
  );
} 