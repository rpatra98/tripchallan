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
        <div className="mt-4">
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-3">
            <h3 className="text-blue-800 font-semibold mb-2">Operator Permissions Management</h3>
            <p className="text-sm text-blue-600">
              As an admin, you can modify what this operator can do in the system.
              Click the button below to change permissions.
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Edit Permissions
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-md border border-gray-200 mt-3">
          <h3 className="font-semibold text-gray-800 mb-3">Update Operator Permissions</h3>
          <div className="space-y-4">
            <div className="bg-white p-3 rounded border border-gray-200 flex items-center">
              <input
                id="canCreate"
                name="canCreate"
                type="checkbox"
                checked={permissions.canCreate}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <label htmlFor="canCreate" className="text-gray-700 font-medium block">
                  Can Create New Trips/Sessions
                </label>
                <p className="text-xs text-gray-500">
                  Allows the operator to create new trips and sessions in the system
                </p>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded border border-gray-200 flex items-center">
              <input
                id="canModify"
                name="canModify"
                type="checkbox"
                checked={permissions.canModify}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <label htmlFor="canModify" className="text-gray-700 font-medium block">
                  Can Modify Existing Trips/Sessions
                </label>
                <p className="text-xs text-gray-500">
                  Allows the operator to edit details of existing trips
                </p>
              </div>
            </div>
            
            <div className="bg-white p-3 rounded border border-gray-200 flex items-center">
              <input
                id="canDelete"
                name="canDelete"
                type="checkbox"
                checked={permissions.canDelete}
                onChange={handlePermissionChange}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <label htmlFor="canDelete" className="text-gray-700 font-medium block">
                  Can Delete Trips/Sessions
                </label>
                <p className="text-xs text-gray-500">
                  Allows the operator to delete existing trips (use with caution)
                </p>
              </div>
            </div>
          </div>

          <div className="flex mt-4 gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 