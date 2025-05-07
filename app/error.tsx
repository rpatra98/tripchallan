'use client';

import { useEffect } from 'react';
import { Button } from '../components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // Log error to console in development mode
    if (isDev) {
      console.error('Application error:', error);
    }
    
    // Could send to error monitoring service here
  }, [error, isDev]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md p-6 bg-white shadow-lg rounded-lg dark:bg-gray-800">
        <h2 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">
          Something went wrong!
        </h2>
        <p className="mb-6 text-gray-700 dark:text-gray-300">
          We apologize for the inconvenience. The application encountered an unexpected error.
          You can try resetting the application or go back to the homepage.
        </p>
        
        {isDev && (
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-900 rounded overflow-auto text-left">
            <p className="font-mono text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
              {error.message}
              {error.stack && <span className="block mt-2 text-xs">{error.stack}</span>}
              {error.digest && <span className="block mt-2 text-xs">Digest: {error.digest}</span>}
            </p>
          </div>
        )}
        
        <div className="flex justify-center space-x-4">
          <Button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            Go to Homepage
          </Button>
        </div>
      </div>
    </div>
  );
} 