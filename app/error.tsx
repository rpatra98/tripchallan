'use client';

import React, { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRedirectLoop, setIsRedirectLoop] = useState(false);
  const [isClearingCookies, setIsClearingCookies] = useState(false);

  useEffect(() => {
    // Check if this might be a redirect loop
    if (
      error.message?.includes('redirect') ||
      error.message?.includes('NEXT_REDIRECT') ||
      typeof window !== 'undefined' && window.performance?.navigation?.type === 2 ||
      document.referrer === window.location.href ||
      sessionStorage.getItem('redirectCount') === '3'
    ) {
      setIsRedirectLoop(true);
      console.error('Possible redirect loop detected:', error);
    }

    // Track redirect count in session storage
    const currentCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
    sessionStorage.setItem('redirectCount', (currentCount + 1).toString());
    
    // Reset count after 10 seconds
    const timer = setTimeout(() => {
      sessionStorage.removeItem('redirectCount');
    }, 10000);

    return () => clearTimeout(timer);
  }, [error]);

  const handleClearSession = async () => {
    setIsClearingCookies(true);
    
    try {
      // Clear all cookies
      document.cookie.split(';').forEach(c => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Sign out from NextAuth
      await signOut({ redirect: false });
      
      // Redirect to homepage after clearing everything
      window.location.href = '/?reset=true';
    } catch (e) {
      console.error('Error clearing session:', e);
      // Force redirect even if there was an error
      window.location.href = '/?reset=true';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Something went wrong!</h1>
        
        {isRedirectLoop ? (
          <>
            <p className="mb-4">
              We detected a possible redirect loop. This usually happens when there's an issue with your authentication session.
            </p>
            <p className="mb-6 text-gray-600">
              Error details: {error.message || "Too many redirects"}
            </p>
          </>
        ) : (
          <p className="mb-6">
            The application encountered an unexpected error. You can try resetting the application or go back to the homepage.
          </p>
        )}
        
        <div className="flex flex-col space-y-4">
          <button
            onClick={reset}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            disabled={isClearingCookies}
          >
            Try again
          </button>
          
          <Link 
            href="/"
            className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Go to Homepage
          </Link>
          
          <button
            onClick={handleClearSession}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
            disabled={isClearingCookies}
          >
            {isClearingCookies ? 'Clearing session...' : 'Reset Session & Cookies'}
          </button>
        </div>
      </div>
    </div>
  );
} 