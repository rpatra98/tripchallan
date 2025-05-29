'use client';

import React from 'react';
import { signOut } from 'next-auth/react';

interface SessionErrorPageProps {
  redirectLoopDetected?: boolean;
  invalidRole?: boolean;
}

const SessionErrorPage: React.FC<SessionErrorPageProps> = ({ 
  redirectLoopDetected = false,
  invalidRole = false
}) => {
  const handleClearSession = async () => {
    // Redirect to our custom logout page
    window.location.href = "/api/auth/logout?callbackUrl=/";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-400">Session Error</h1>
        
        {redirectLoopDetected ? (
          <p className="mb-6">
            Too many redirects detected. This usually happens when there's an issue with your authentication session.
          </p>
        ) : invalidRole ? (
          <p className="mb-6">
            Your user account has an invalid role. Please contact the administrator.
          </p>
        ) : (
          <p className="mb-6">
            Your session is invalid or has expired. The user account associated with your session could not be found.
          </p>
        )}
        
        <p className="mb-6">
          Please clear your cookies and sign in again.
        </p>
        <div className="flex flex-col space-y-4">
          <a 
            href="/" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Return to Login
          </a>
          <button
            onClick={handleClearSession}
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Clear Session & Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionErrorPage; 