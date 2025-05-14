"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// Dynamically import without SSR since it's a client component
const PermissionsEditor = dynamic(() => import("./PermissionsEditor"), { 
  ssr: false 
});

interface PermissionsEditorWrapperProps {
  employeeId: string;
  initialPermissions: {
    canCreate: boolean;
    canModify: boolean;
    canDelete: boolean;
  };
}

export default function PermissionsEditorWrapper({ 
  employeeId, 
  initialPermissions
}: PermissionsEditorWrapperProps) {
  const router = useRouter();

  const handleSuccess = () => {
    // Refresh the current page to show updated permissions
    router.refresh();
  };

  return (
    <PermissionsEditor
      employeeId={employeeId}
      initialPermissions={initialPermissions}
      onSuccess={handleSuccess}
    />
  );
} 