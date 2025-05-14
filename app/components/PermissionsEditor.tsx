"use client";

import { useState } from "react";

interface PermissionsEditorProps {
  employeeId: string;
  initialPermissions: {
    canCreate: boolean;
    canModify: boolean;
    canDelete: boolean;
  };
  onSuccess: () => void;
}

export default function PermissionsEditor({ 
  employeeId, 
  initialPermissions, 
  onSuccess 
}: PermissionsEditorProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/employees/${employeeId}/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(permissions)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update permissions");
      }

      setSuccess("Permissions updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (err) {
      console.error("Error updating permissions:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setPermissions(initialPermissions);
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  return (
    <div className="mt-4">
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
          <p>{success}</p>
        </div>
      )}

      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Edit Permissions
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4 mt-2">
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="canCreate"
                name="canCreate"
                type="checkbox"
                checked={permissions.canCreate}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="canCreate" className="ml-3 text-gray-700">
                Can Create New Trips/Sessions
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="canModify"
                name="canModify"
                type="checkbox"
                checked={permissions.canModify}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="canModify" className="ml-3 text-gray-700">
                Can Modify Existing Trips/Sessions
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="canDelete"
                name="canDelete"
                type="checkbox"
                checked={permissions.canDelete}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="canDelete" className="ml-3 text-gray-700">
                Can Delete Trips/Sessions
              </label>
            </div>
          </div>

          <div className="flex mt-4 gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 