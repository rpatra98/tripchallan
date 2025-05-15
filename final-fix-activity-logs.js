const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the entire content of the file
const originalContent = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${originalContent.length} bytes`);

// Add the missing imports that were accidentally removed
let newContent = originalContent;
if (!originalContent.includes("import { useState")) {
  newContent = newContent.replace(
    `"use client";`,
    `"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, ActivityAction } from "@/prisma/enums";`
  );
}

// Remove the remaining column definition code
newContent = newContent.replace(
  /\s+header: "Time",[\s\S]*?},\s*\],/,
  "\n\n"
);

// Write the changes back to the file
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`New file size: ${newContent.length} bytes`);
console.log('Completed final fix for ActivityLogs page'); 