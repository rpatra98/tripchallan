"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyActions({ companyId, companyName, isActive }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Handle company activation/deactivation
  const handleToggleActivation = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !isActive
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update company');
      }

      // Refresh the current page to reflect changes
      router.refresh();
    } catch (err) {
      console.error('Error toggling company activation:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle showing the delete confirmation modal
  const showDeleteConfirmation = () => {
    setShowDeleteModal(true);
    setPassword('');
    setPasswordError('');
  };

  // Handle deleting the company
  const handleDeleteCompany = async (e) => {
    e.preventDefault();
    
    if (!password) {
      setPasswordError('Please enter your password to confirm deletion');
      return;
    }
    
    setLoading(true);
    setPasswordError('');

    try {
      // First verify the password
      const verifyResponse = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        throw new Error(verifyData.error || 'Password verification failed');
      }

      // If password is verified, proceed with company deletion
      const deleteResponse = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmed: true
        }),
      });

      if (!deleteResponse.ok) {
        const deleteData = await deleteResponse.json();
        throw new Error(deleteData.error || 'Failed to delete company');
      }

      // Close the modal and redirect to dashboard
      setShowDeleteModal(false);
      router.push('/dashboard?tab=companies');
      router.refresh();
    } catch (err) {
      console.error('Error deleting company:', err);
      setPasswordError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-4">
        <button
          onClick={handleToggleActivation}
          disabled={loading}
          className={`px-4 py-2 text-white rounded-md transition-colors ${
            isActive
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {loading ? 'Processing...' : isActive ? 'Deactivate Company' : 'Activate Company'}
        </button>
        
        <button
          onClick={showDeleteConfirmation}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          Delete Company
        </button>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Delete Company</h3>
            <p className="mb-4">
              Are you sure you want to permanently delete <strong>{companyName}</strong>? This action cannot be undone.
            </p>
            
            <form onSubmit={handleDeleteCompany}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Enter your admin password to confirm:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`shadow appearance-none border ${
                    passwordError ? 'border-red-500' : 'border-gray-300'
                  } rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                  placeholder="Your password"
                />
                {passwordError && (
                  <p className="text-red-500 text-xs italic mt-1">{passwordError}</p>
                )}
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                >
                  {loading ? 'Deleting...' : 'Delete Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 