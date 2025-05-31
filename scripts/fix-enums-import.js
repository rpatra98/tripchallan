#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Searching for files importing from @/prisma/enums...');

// Get all files that import from @/prisma/enums
let files;
try {
  const grepOutput = execSync('npx grep -l "@/prisma/enums" --include="*.ts" --include="*.tsx" -r .', { encoding: 'utf8' });
  files = grepOutput.trim().split('\n').filter(Boolean);
  console.log(`Found ${files.length} files with @/prisma/enums imports`);
} catch (error) {
  // If grep command fails, it might be because there are no matches
  console.log('No files found with @/prisma/enums imports');
  process.exit(0);
}

// Process each file
let updatedCount = 0;

files.forEach(filePath => {
  console.log(`Processing ${filePath}...`);
  
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the import
    const updatedContent = content.replace(
      /from\s+["']@\/prisma\/enums["']/g, 
      'from "@/lib/enums"'
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