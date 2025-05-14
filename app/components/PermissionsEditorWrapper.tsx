"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

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
  return (
    <PermissionsEditor
      employeeId={employeeId}
      initialPermissions={initialPermissions}
      onSuccess={() => {}}
    />
  );
} 