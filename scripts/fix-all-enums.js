#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting to replace all @/prisma/enums imports with @/lib/enums...');

// Define the paths to search in
const searchPaths = [
  './app',
  './components',
];

// Function to find all TypeScript/JavaScript files in a directory recursively
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (
      file.endsWith('.ts') || 
      file.endsWith('.tsx') || 
      file.endsWith('.js') || 
      file.endsWith('.jsx')
    ) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Process each file and replace the imports
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the file contains @/prisma/enums
    if (content.includes('@/prisma/enums')) {
      console.log(`Processing ${filePath}`);
      
      // Replace all occurrences of @/prisma/enums with @/lib/enums
      const updatedContent = content.replace(/@\/prisma\/enums/g, '@/lib/enums');
      
      // Write the updated content back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✅ Updated ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

// Main execution
let totalFiles = 0;
let updatedFiles = 0;

searchPaths.forEach(searchPath => {
  console.log(`Searching in ${searchPath}...`);
  const files = findFiles(searchPath);
  totalFiles += files.length;
  
  files.forEach(file => {
    const wasUpdated = processFile(file);
    if (wasUpdated) {
      updatedFiles++;
    }
  });
});

console.log(`\n🎉 Finished updating ${updatedFiles} out of ${totalFiles} files.`);
console.log('All @/prisma/enums imports should now be @/lib/enums'); 