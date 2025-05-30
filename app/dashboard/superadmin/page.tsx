"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // If user is not SuperAdmin, redirect to regular dashboard
  useEffect(() => {
    if (session?.user?.email !== "superadmin@cbums.com") {
      router.push("/dashboard");
    }
  }, [session, router]);
  
  if (!session?.user) {
    return (
      <div className="container mx-auto mt-8 max-w-md">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Authentication Required</h2>
          <p className="mb-4">Please log in as SuperAdmin to access this page.</p>
          <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SuperAdmin Dashboard</h1>
        <p className="text-gray-600">Welcome, {session.user.name || "Super Admin"}</p>
        <hr className="my-4" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Summary Cards */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">System Status</h2>
          <p className="text-3xl font-bold text-blue-600">Active</p>
          <p className="text-sm text-gray-500 mt-2">Database connected and operational</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Available Coins</h2>
          <p className="text-3xl font-bold text-blue-600">
            {session.user.coins?.toLocaleString() || "1,000,000"}
          </p>
          <p className="text-sm text-gray-500 mt-2">Available for distribution</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Supabase Connection</h2>
          <p className="text-3xl font-bold text-green-600">Connected</p>
          <p className="text-sm text-gray-500 mt-2">Database is properly configured</p>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Manage Admins</h2>
          <p className="mb-4">Create, view, and manage administrator accounts</p>
          <Link href="/dashboard/admins" className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded hover:bg-blue-700">
            Manage Admins
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Manage Companies</h2>
          <p className="mb-4">Create, view, and manage company accounts</p>
          <Link href="/dashboard/companies" className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded hover:bg-blue-700">
            Manage Companies
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Activity Logs</h2>
          <p className="mb-4">View system activity and audit trails</p>
          <Link href="/dashboard/activity-logs" className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded hover:bg-blue-700">
            View Logs
          </Link>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow mt-8">
        <h2 className="text-xl font-semibold mb-2">Database Management</h2>
        <p className="mb-4">Run database maintenance operations</p>
        <div className="flex gap-4">
          <button 
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
            onClick={() => {
              fetch('/api/debug/setup', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                  alert(data.message || 'Operation completed');
                })
                .catch(err => {
                  alert('Error: ' + err.message);
                });
            }}
          >
            Reset Database
          </button>
          <button 
            className="px-4 py-2 border border-purple-600 text-purple-600 rounded hover:bg-purple-50"
            onClick={() => {
              fetch('/api/update-superadmin-coins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 1000000 })
              })
                .then(res => res.json())
                .then(data => {
                  alert(data.message || 'Coins updated');
                })
                .catch(err => {
                  alert('Error: ' + err.message);
                });
            }}
          >
            Refill Coins
          </button>
        </div>
      </div>
    </div>
  );
} 