#!/usr/bin/env node

/**
 * This script directly targets the specific files that are causing build errors
 * by replacing @/prisma/enums with @/lib/enums.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Starting direct fix for specific files...');

// List of files that are failing in the build
const filesToFix = [
  'app/api/activity-logs/route.ts',
  'app/api/admin/employees/route.ts',
  'app/api/admins/[id]/accessible-companies/route.ts',
  'app/api/admins/[id]/employee-companies/route.ts',
  'app/api/admins/[id]/sessions/route.ts'
];

let successCount = 0;
let errorCount = 0;

// Process each file
filesToFix.forEach(relativeFilePath => {
  const filePath = path.join(process.cwd(), relativeFilePath);
  
  try {
    console.log(`Processing ${filePath}...`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File does not exist: ${filePath}`);
      return;
    }
    
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the import
    const updatedContent = content.replace(
      /from\s+["']@\/prisma\/enums["']/g, 
      'from "@/lib/enums"'
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`✅ Updated ${filePath}`);
    successCount++;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    errorCount++;
  }
});

console.log(`\n🎉 Direct fix completed: ${successCount} files updated, ${errorCount} errors.`);

// Also create a lib/enums.ts file if it doesn't exist, just in case
const enumsFilePath = path.join(process.cwd(), 'lib/enums.ts');
if (!fs.existsSync(enumsFilePath)) {
  try {
    console.log('Creating lib/enums.ts file...');
    
    // Create the directory if it doesn't exist
    const enumsDirPath = path.join(process.cwd(), 'lib');
    if (!fs.existsSync(enumsDirPath)) {
      fs.mkdirSync(enumsDirPath, { recursive: true });
    }
    
    // Create a basic enums file with common enums
    const enumsContent = `
// Enum definitions for the application
// Previously located at @/prisma/enums, now moved to @/lib/enums

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  COMPANY = 'COMPANY',
  EMPLOYEE = 'EMPLOYEE'
}

export enum EmployeeSubrole {
  OPERATOR = 'OPERATOR',
  DRIVER = 'DRIVER',
  GUARD = 'GUARD',
  TRANSPORTER = 'TRANSPORTER'
}

export enum SessionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum SealStatus {
  ACTIVE = 'ACTIVE',
  VERIFIED = 'VERIFIED',
  BROKEN = 'BROKEN',
  MISSING = 'MISSING'
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE'
}

export enum TransactionReason {
  ALLOCATION = 'ALLOCATION',
  SESSION_CREATION = 'SESSION_CREATION',
  ADMIN_CREATION = 'ADMIN_CREATION',
  ADJUSTMENT = 'ADJUSTMENT'
}

export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  VERIFY = 'VERIFY',
  TRANSFER = 'TRANSFER'
}
`;
    
    fs.writeFileSync(enumsFilePath, enumsContent, 'utf8');
    console.log(`✅ Created ${enumsFilePath}`);
  } catch (error) {
    console.error(`❌ Error creating lib/enums.ts:`, error);
  }
}

// Exit with success
process.exit(0); 