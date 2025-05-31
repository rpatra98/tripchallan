#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Searching for files importing Prisma client...');

// Get all files that import prisma client
let prismaImportFiles;
try {
  const grepOutput = execSync('npx grep -l "from \\"@/lib/prisma\\"" --include="*.ts" --include="*.tsx" -r .', { encoding: 'utf8' });
  prismaImportFiles = grepOutput.trim().split('\n').filter(Boolean);
  console.log(`Found ${prismaImportFiles.length} files with Prisma client imports`);
} catch (error) {
  // If grep command fails, it might be because there are no matches
  console.log('No files found with Prisma client imports');
  prismaImportFiles = [];
}

// Get all files that import Prisma types
let prismaTypeFiles;
try {
  const grepOutput = execSync('npx grep -l "from \\"@prisma/client\\"" --include="*.ts" --include="*.tsx" -r .', { encoding: 'utf8' });
  prismaTypeFiles = grepOutput.trim().split('\n').filter(Boolean);
  console.log(`Found ${prismaTypeFiles.length} files with Prisma types imports`);
} catch (error) {
  // If grep command fails, it might be because there are no matches
  console.log('No files found with Prisma types imports');
  prismaTypeFiles = [];
}

// Combine unique files
const allFiles = [...new Set([...prismaImportFiles, ...prismaTypeFiles])];
console.log(`Processing ${allFiles.length} unique files with Prisma imports`);

// Process each file
let updatedCount = 0;

allFiles.forEach(filePath => {
  console.log(`Processing ${filePath}...`);
  
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace Prisma imports with Supabase
    let updatedContent = content;
    
    // Replace prisma client import
    updatedContent = updatedContent.replace(
      /import\s+(?:prisma|client|db|\{\s*prisma\s*\}|\{\s*PrismaClient\s*\})\s+from\s+["']@\/lib\/prisma["'];?/g,
      'import { supabase } from "@/lib/supabase";'
    );
    
    // Replace Prisma types import
    updatedContent = updatedContent.replace(
      /import\s+\{\s*Prisma(?:,\s*[^}]+)?\s*\}\s+from\s+["']@prisma\/client["'];?/g,
      '// Prisma types have been removed in favor of Supabase'
    );
    
    // Replace prisma method calls
    updatedContent = updatedContent.replace(/prisma\.(user|company|session|vehicle|seal|activityLog|coinTransaction|operatorPermission)/g, 
      (match, tableName) => {
        // Convert PascalCase or camelCase to snake_case for Supabase tables
        const snakeCaseTable = tableName
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
        
        return `supabase.from('${snakeCaseTable}s')`;
      }
    );
    
    // Check if the content was actually updated
    if (content !== updatedContent) {
      // Write the updated content back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      updatedCount++;
      console.log(`✅ Updated ${filePath}`);
    } else {
      console.log(`⚠️ No changes needed in ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
});

console.log(`\n🎉 Finished updating ${updatedCount} files.`); 